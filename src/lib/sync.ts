// Sincronización opcional con Supabase (plan gratuito). Si no está configurada, la app funciona
// igual en modo local y lo indica claramente: nunca simula una sincronización que no existe.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db, getMeta, setMeta } from './db';
import { onLocalChange, recomputeCardStates } from './repo';
import type { OutboxEntry, ReviewEvent, SyncedTable } from './types';
import { nowIso } from './util';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'build' | 'device';
}

export type SyncState = 'unconfigured' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  email?: string;
  lastSyncAt?: string;
  pending: number;
  error?: string;
  config?: SupabaseConfig;
}

let status: SyncStatus = { state: 'unconfigured', pending: 0 };
const subs = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const s of subs) s();
}
export function subscribeSync(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function getSyncStatus(): SyncStatus {
  return status;
}

let client: SupabaseClient | null = null;
let clientKey = '';
let testClient: SupabaseClient | null = null;

/** Solo para pruebas: inyecta un cliente simulado. */
export function setClientForTests(c: SupabaseClient | null): void {
  testClient = c;
}

export async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  const device = await getMeta<{ url: string; anonKey: string } | null>('supabaseConfig', null);
  if (device?.url && device?.anonKey) return { ...device, source: 'device' };
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) return { url, anonKey, source: 'build' };
  return null;
}

export async function saveDeviceSupabaseConfig(cfg: { url: string; anonKey: string } | null): Promise<void> {
  await setMeta('supabaseConfig', cfg);
  client = null;
  clientKey = '';
  await initSync();
}

export async function getClient(): Promise<SupabaseClient | null> {
  if (testClient) return testClient;
  const cfg = await getSupabaseConfig();
  if (!cfg) return null;
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'c2r-auth' },
    });
    clientKey = key;
  }
  return client;
}

async function refreshPending() {
  setStatus({ pending: await db.outbox.count() });
}

export async function initSync(): Promise<void> {
  const cfg = await getSupabaseConfig();
  await refreshPending();
  if (!cfg) {
    setStatus({ state: 'unconfigured', config: undefined, email: undefined });
    return;
  }
  const sb = await getClient();
  const { data } = await sb!.auth.getSession();
  const lastSyncAt = await getMeta<string | undefined>('lastSyncAt', undefined);
  setStatus({ config: cfg, lastSyncAt, email: data.session?.user.email, state: data.session ? 'idle' : 'signed-out' });
  sb!.auth.onAuthStateChange((_event, session) => {
    setStatus({ email: session?.user.email, state: session ? (status.state === 'syncing' ? 'syncing' : 'idle') : 'signed-out' });
  });
  if (data.session) void syncNow();
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = await getClient();
  if (!sb) throw new Error('La sincronización no está configurada.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
  setStatus({ state: 'idle', email });
  await syncNow();
}

export async function signUp(email: string, password: string): Promise<'signed-in' | 'confirm-email'> {
  const sb = await getClient();
  if (!sb) throw new Error('La sincronización no está configurada.');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
  if (data.session) {
    setStatus({ state: 'idle', email });
    await syncNow();
    return 'signed-in';
  }
  return 'confirm-email';
}

export async function signOut(): Promise<void> {
  const sb = await getClient();
  await sb?.auth.signOut();
  setStatus({ state: 'signed-out', email: undefined });
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Tenés que confirmar el email (revisá tu bandeja de entrada).';
  if (/already registered/i.test(msg)) return 'Ese email ya tiene una cuenta: iniciá sesión.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/signups? not allowed/i.test(msg)) return 'Los registros nuevos están desactivados en este proyecto.';
  if (/failed to fetch|network/i.test(msg)) return 'Sin conexión con el servidor.';
  return msg;
}

const RECORD_TABLES: Exclude<SyncedTable, 'reviews'>[] = ['knowledge', 'cards', 'decks', 'settings', 'sources', 'errorLogs', 'importBatches'];
const PAGE = 500;

let running: Promise<void> | null = null;

/** Sube cambios pendientes y descarga los del otro dispositivo. Seguro de llamar varias veces. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const sb = await getClient();
    if (!sb) return setStatus({ state: 'unconfigured' });
    const { data } = await sb.auth.getSession();
    if (!data.session) return setStatus({ state: 'signed-out' });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await refreshPending();
      return setStatus({ state: 'offline' });
    }
    setStatus({ state: 'syncing', error: undefined });
    try {
      await push(sb);
      await pull(sb);
      const at = nowIso();
      await setMeta('lastSyncAt', at);
      await refreshPending();
      setStatus({ state: 'idle', lastSyncAt: at });
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      await refreshPending();
      setStatus({ state: /fetch|network/i.test(message) ? 'offline' : 'error', error: message });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

async function push(sb: SupabaseClient): Promise<void> {
  for (;;) {
    const batch = await db.outbox.orderBy('queuedAt').limit(PAGE).toArray();
    if (!batch.length) return;
    const byTable = new Map<SyncedTable, OutboxEntry[]>();
    for (const e of batch) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e]);
    for (const [table, entries] of byTable) {
      if (table === 'reviews') {
        const rows = (await db.reviews.bulkGet(entries.map((e) => e.id))).filter((r): r is ReviewEvent => !!r);
        if (rows.length) {
          const { error } = await sb.rpc('push_reviews', {
            items: rows.map((r) => ({ id: r.id, card_id: r.cardId, reviewed_at: r.reviewedAt, data: r, updated_at: r.updatedAt, deleted: !!r.deleted })),
          });
          if (error) throw new Error(error.message);
        }
      } else {
        const rows = (await db.table(table).bulkGet(entries.map((e) => e.id))) as ({ id: string; updatedAt: string; deleted?: boolean } | undefined)[];
        const items = rows.filter((r): r is { id: string; updatedAt: string; deleted?: boolean } => !!r)
          .map((r) => ({ collection: table, id: r.id, data: r, updated_at: r.updatedAt, deleted: !!r.deleted }));
        if (items.length) {
          const { error } = await sb.rpc('push_records', { items });
          if (error) throw new Error(error.message);
        }
      }
    }
    // Solo se quitan del outbox las entradas que no cambiaron mientras se subían.
    await db.transaction('rw', db.outbox, async () => {
      for (const e of batch) {
        const cur = await db.outbox.get(e.key);
        if (cur && cur.queuedAt === e.queuedAt) await db.outbox.delete(e.key);
      }
    });
    if (batch.length < PAGE) return;
  }
}

async function pull(sb: SupabaseClient): Promise<void> {
  const overlap = (iso: string) => new Date(new Date(iso).getTime() - 5000).toISOString();
  // Registros
  let cursor = await getMeta<string>('pullCursor:records', '1970-01-01T00:00:00Z');
  for (;;) {
    const { data, error } = await sb.from('records').select('collection,id,data,updated_at,deleted,server_updated_at')
      .gt('server_updated_at', overlap(cursor)).order('server_updated_at', { ascending: true }).limit(1000);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const table of RECORD_TABLES) {
      const rows = data.filter((r) => r.collection === table);
      if (!rows.length) continue;
      const locals = (await db.table(table).bulkGet(rows.map((r) => r.id))) as ({ updatedAt?: string } | undefined)[];
      // Última escritura gana: si la copia local es más nueva, se conserva (y se subirá en el próximo push).
      const toPut = rows.filter((r, i) => !locals[i] || (locals[i]!.updatedAt ?? '') <= r.updated_at)
        .map((r) => ({ ...(r.data as object), deleted: r.deleted }));
      if (toPut.length) await db.table(table).bulkPut(toPut);
    }
    const last = data[data.length - 1].server_updated_at as string;
    if (last === cursor) break;
    cursor = last;
    await setMeta('pullCursor:records', cursor);
    if (data.length < 1000) break;
  }
  // Repasos: se unen y se recalcula el estado FSRS de las tarjetas afectadas.
  let rCursor = await getMeta<string>('pullCursor:reviews', '1970-01-01T00:00:00Z');
  const affected = new Set<string>();
  for (;;) {
    const { data, error } = await sb.from('review_events').select('id,data,updated_at,deleted,server_updated_at')
      .gt('server_updated_at', overlap(rCursor)).order('server_updated_at', { ascending: true }).limit(1000);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    const locals = await db.reviews.bulkGet(data.map((r) => r.id as string));
    const toPut: ReviewEvent[] = [];
    data.forEach((r, i) => {
      const local = locals[i];
      const remote = { ...(r.data as ReviewEvent), deleted: r.deleted as boolean };
      if (!local || local.updatedAt < remote.updatedAt || local.deleted !== remote.deleted) {
        toPut.push(remote);
        affected.add(remote.cardId);
      }
    });
    if (toPut.length) await db.reviews.bulkPut(toPut);
    const last = data[data.length - 1].server_updated_at as string;
    if (last === rCursor) break;
    rCursor = last;
    await setMeta('pullCursor:reviews', rCursor);
    if (data.length < 1000) break;
  }
  if (affected.size) {
    const ids = [...affected];
    for (let i = 0; i < ids.length; i += 400) await recomputeCardStates(ids.slice(i, i + 400));
  }
}

// ── Disparadores automáticos ──
let debounce: ReturnType<typeof setTimeout> | undefined;
let started = false;
export function startAutoSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  onLocalChange(() => {
    void refreshPending();
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (status.state === 'idle' || status.state === 'offline' || status.state === 'error') void syncNow();
    }, 4000);
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus({ state: status.state === 'unconfigured' || status.state === 'signed-out' ? status.state : 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && (status.state === 'idle' || status.state === 'offline')) void syncNow();
  }, 120_000);
}

// ── Integración directa (Método 2) ──
export async function createImportToken(label: string): Promise<string> {
  const sb = await getClient();
  if (!sb) throw new Error('La sincronización no está configurada.');
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `c2r_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const { error } = await sb.from('import_tokens').insert({ token_hash: hash, label });
  if (error) throw new Error(error.message);
  return token;
}

export interface InboxItem {
  id: string;
  title: string;
  payload: unknown;
  created_at: string;
}

export async function listInbox(): Promise<InboxItem[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb.from('import_inbox').select('id,title,payload,created_at').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxItem[];
}

export async function markInbox(id: string, status: 'applied' | 'discarded'): Promise<void> {
  const sb = await getClient();
  if (!sb) return;
  const { error } = await sb.from('import_inbox').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listImportTokens(): Promise<{ token_hash: string; label: string; created_at: string; last_used_at: string | null }[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb.from('import_tokens').select('token_hash,label,created_at,last_used_at').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function revokeImportToken(hash: string): Promise<void> {
  const sb = await getClient();
  if (!sb) return;
  const { error } = await sb.from('import_tokens').delete().eq('token_hash', hash);
  if (error) throw new Error(error.message);
}
