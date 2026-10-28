// Sincronización entre dos dispositivos simulados contra un servidor en memoria que reproduce
// las reglas de supabase/migrations/0001_init.sql (LWW en registros, repasos con id único).
import { afterAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, useTestDB } from '../src/lib/db';
import { installSeed } from '../src/lib/seed';
import { recordReview, updateKnowledge, undoReview } from '../src/lib/repo';
import { setClientForTests, syncNow, getSyncStatus } from '../src/lib/sync';
import { loadSeed } from './helpers';

interface Row { collection?: string; id: string; data: unknown; updated_at: string; deleted: boolean; server_updated_at: string; card_id?: string; reviewed_at?: string }

function makeServer() {
  const records = new Map<string, Row>();
  const reviews = new Map<string, Row>();
  let clock = Date.parse('2026-11-01T00:00:00Z');
  const tick = () => new Date((clock += 1000)).toISOString();
  let pushes = 0;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { email: 'matias@example.com' } } } }), onAuthStateChange: () => ({ data: {} }) },
    rpc: async (name: string, { items }: { items: Record<string, unknown>[] }) => {
      pushes++;
      for (const x of items) {
        const target = name === 'push_reviews' ? reviews : records;
        const key = name === 'push_reviews' ? String(x.id) : `${x.collection}:${x.id}`;
        const cur = target.get(key);
        if (!cur || cur.updated_at <= String(x.updated_at)) {
          target.set(key, { ...(x as object), id: String(x.id), data: x.data, updated_at: String(x.updated_at), deleted: !!x.deleted, server_updated_at: tick() } as Row);
        }
      }
      return { data: items.length, error: null };
    },
    from: (table: string) => {
      const source = table === 'records' ? records : reviews;
      let gt = '';
      let limit = 1000;
      const q = {
        select: () => q,
        gt: (_c: string, v: string) => { gt = v; return q; },
        order: () => q,
        limit: (n: number) => { limit = n; return q; },
        then: (resolve: (v: { data: Row[]; error: null }) => void) => {
          const data = [...source.values()].filter((r) => r.server_updated_at > gt).sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at)).slice(0, limit);
          resolve({ data: structuredClone(data), error: null });
        },
      };
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, records, reviews, pushes: () => pushes };
}

async function device(name: string) {
  const d = useTestDB(name);
  await installSeed(loadSeed());
  return d;
}

describe('sincronización entre dispositivos', () => {
  const server = makeServer();
  setClientForTests(server.client);
  afterAll(() => setClientForTests(null));
  const stamp = Date.now();
  const notebook = `notebook-${stamp}`;
  const iphone = `iphone-${stamp}`;

  it('los repasos y ediciones de un dispositivo llegan al otro sin duplicarse', async () => {
    await device(notebook);
    const card = (await db.cards.get('work-like-magic:es2en:auto'))!;
    await recordReview({ card, rating: 3, durationMs: 3000, at: new Date('2026-11-01T10:00:00Z') });
    await recordReview({ card, rating: 3, durationMs: 3000, at: new Date('2026-11-01T10:12:00Z') });
    await updateKnowledge('dawn-on', { notes: 'nota desde la notebook' });
    await syncNow();
    expect(getSyncStatus().state).toBe('idle');
    expect(await db.outbox.count()).toBe(0);
    const notebookState = await db.cardStates.get(card.id);
    // Volver a enviar lo mismo no crea duplicados en el servidor.
    const before = server.reviews.size;
    await db.outbox.bulkPut((await db.reviews.toArray()).map((r) => ({ key: `reviews:${r.id}`, table: 'reviews' as const, id: r.id, queuedAt: new Date().toISOString() })));
    await syncNow();
    expect(server.reviews.size).toBe(before);

    await device(iphone);
    await syncNow();
    expect(await db.reviews.where('cardId').equals(card.id).count()).toBe(2);
    expect(await db.cardStates.get(card.id)).toEqual(notebookState);
    expect((await db.knowledge.get('dawn-on'))!.notes).toBe('nota desde la notebook');
  });

  it('repasos offline en ambos dispositivos se unen y el estado FSRS converge', async () => {
    // iPhone (offline) repasa otra tarjeta
    useTestDB(iphone);
    const c2 = (await db.cards.get('take-exception-to:es2en:auto'))!;
    await recordReview({ card: c2, rating: 1, durationMs: 2000, at: new Date('2026-11-02T08:00:00Z') });
    // Notebook (offline) repasa la misma tarjeta más tarde
    useTestDB(notebook);
    await recordReview({ card: c2, rating: 3, durationMs: 2000, at: new Date('2026-11-02T20:00:00Z') });
    // Se reconectan: ambos sincronizan (dos rondas para propagar)
    await syncNow();
    useTestDB(iphone);
    await syncNow();
    const iphoneState = await db.cardStates.get(c2.id);
    useTestDB(notebook);
    await syncNow();
    const notebookState = await db.cardStates.get(c2.id);
    expect(notebookState).toEqual(iphoneState);
    expect(notebookState!.reps).toBe(2);
    expect(notebookState!.lapses).toBe(0);
    expect(await db.reviews.where('cardId').equals(c2.id).count()).toBe(2);
  });

  it('última escritura gana en ediciones concurrentes y deshacer se propaga', async () => {
    useTestDB(notebook);
    await updateKnowledge('in-this-day-and-age', { notes: 'versión notebook' });
    await new Promise((r) => setTimeout(r, 15));
    useTestDB(iphone);
    await updateKnowledge('in-this-day-and-age', { notes: 'versión iPhone (más nueva)' });
    const card = (await db.cards.get('in-this-day-and-age:es2en:auto'))!;
    const r = await recordReview({ card, rating: 4, durationMs: 1000 });
    await undoReview(r);
    await syncNow();
    useTestDB(notebook);
    await syncNow();
    useTestDB(iphone);
    await syncNow();
    useTestDB(notebook);
    expect((await db.knowledge.get('in-this-day-and-age'))!.notes).toBe('versión iPhone (más nueva)');
    expect((await db.reviews.get(r.event.id))!.deleted).toBe(true);
    expect((await db.cardStates.get(card.id))!.state).toBe(0);
  });
});
