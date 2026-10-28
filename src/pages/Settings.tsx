import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, Download, KeyRound, LogOut, Monitor, Moon, RefreshCw, Sun, Trash2, Upload, Volume2 } from 'lucide-react';
import { useSettings, useSyncStatus } from '../lib/hooks';
import { recomputeAllStates, saveSettings } from '../lib/repo';
import { cardsCsv, exportAll, knowledgeCsv, restoreBackup, reviewsCsv } from '../lib/backup';
import { createImportToken, getSupabaseConfig, listImportTokens, revokeImportToken, saveDeviceSupabaseConfig, signIn, signOut, signUp, syncNow } from '../lib/sync';
import { englishVoices, speak, speechAvailable } from '../lib/speech';
import { fetchSeed, installSeed } from '../lib/seed';
import { db, getMeta, setMeta } from '../lib/db';
import { Button, Chip, cx, Field, inputClass, PageHeader, Panel, SectionTitle, Spinner, Toggle } from '../components/ui';
import { useToast } from '../components/toast';
import { download, formatDate } from '../lib/util';
import type { Settings } from '../lib/types';

export default function SettingsPage() {
  const s = useSettings();
  const toast = useToast();
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const seedVersion = useLiveQuery(() => getMeta<string>('seedVersion', '—'), []);
  const lastBackup = useLiveQuery(() => getMeta<string | null>('lastBackupAt', null), []);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader eyebrow="Ajustes" title="Ajustes" subtitle="Personalizá el estudio, la apariencia, la sincronización y tus copias de seguridad." />

      <div className="space-y-4 pb-10">
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Estudio diario" subtitle="Los cambios aplican desde la próxima sesión." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={`Tarjetas nuevas por día: ${s.newPerDay}`} hint="Entre 10 y 25 es sostenible a largo plazo.">
              <input type="range" min={0} max={60} value={s.newPerDay} onChange={(e) => set({ newPerDay: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label={`Máximo de repasos por día: ${s.reviewsPerDay}`}>
              <input type="range" min={50} max={1000} step={10} value={s.reviewsPerDay} onChange={(e) => set({ reviewsPerDay: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label={`Retención objetivo: ${Math.round(s.retention * 100)}%`} hint="Probabilidad de recordar al momento del repaso. Más alta = intervalos más cortos y más repasos.">
              <input type="range" min={0.8} max={0.97} step={0.01} value={s.retention} onChange={(e) => set({ retention: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label={`Meta diaria: ${s.dailyGoalMinutes} min`}>
              <input type="range" min={5} max={90} step={5} value={s.dailyGoalMinutes} onChange={(e) => set({ dailyGoalMinutes: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label="Pasos de aprendizaje" hint="Ej.: 1m 10m (minutos, horas o días)">
              <input className={inputClass} defaultValue={s.learningSteps.join(' ')} onBlur={(e) => set({ learningSteps: e.target.value.split(/\s+/).filter((x) => /^\d+(\.\d+)?[mhd]$/.test(x)) })} />
            </Field>
            <Field label="Pasos de reaprendizaje" hint="Ej.: 10m">
              <input className={inputClass} defaultValue={s.relearningSteps.join(' ')} onBlur={(e) => set({ relearningSteps: e.target.value.split(/\s+/).filter((x) => /^\d+(\.\d+)?[mhd]$/.test(x)) })} />
            </Field>
            <Field label="El día de estudio empieza a las">
              <select className={inputClass} value={s.dayStartsAtHour} onChange={(e) => set({ dayStartsAtHour: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </Field>
            <Field label="Tarjeta «difícil» a partir de (fallos)">
              <select className={inputClass} value={s.leechThreshold} onChange={(e) => set({ leechThreshold: Number(e.target.value) })}>
                {[3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Tu nombre"><input className={inputClass} defaultValue={s.displayName ?? 'Matías'} onBlur={(e) => set({ displayName: e.target.value.trim() || undefined })} /></Field>
            <Field label="Fecha del examen"><input type="date" className={inputClass} value={s.examDate ?? ''} onChange={(e) => set({ examDate: e.target.value || undefined })} /></Field>
          </div>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line px-4">
            <Toggle checked={s.showHintsByDefault} onChange={(v) => set({ showHintsByDefault: v })} label="Mostrar pistas automáticamente" description="Si está apagado, las pistas aparecen solo cuando las pedís (tecla H)." />
            <Toggle checked={s.enableFuzz} onChange={(v) => set({ enableFuzz: v })} label="Variación aleatoria de intervalos (fuzz)" description="Evita que muchas tarjetas venzan el mismo día." />
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Apariencia" />
          <div className="grid grid-cols-3 gap-2">
            {([['system', 'Sistema', Monitor], ['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => set({ theme: v })} className={cx('flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition', s.theme === v ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-2 hover:bg-surface-2')}>
                <Icon size={20} />{label}
              </button>
            ))}
          </div>
        </Panel>

        <VoiceSettings s={s} set={set} />
        <SyncSettings />
        <BackupSettings lastBackup={lastBackup ?? null} />

        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Datos y mantenimiento" />
          <div className="flex flex-wrap gap-2">
            <Button icon={<RefreshCw size={16} />} onClick={async () => { await recomputeAllStates(); toast('Programación recalculada desde el historial'); }}>Recalcular programación</Button>
            <Button onClick={async () => { const r = await installSeed(await fetchSeed(), { force: true }); toast(`Banco inicial revisado: +${r.knowledgeAdded} conocimientos, +${r.cardsAdded} tarjetas (lo editado por vos no se tocó)`); }}>Reinstalar banco inicial</Button>
            <Link to="/coverage"><Button>Informe de cobertura de los PDF</Button></Link>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={async () => {
              if (!confirm('¿Borrar TODOS los datos de este dispositivo? Si no tenés sincronización ni copia de seguridad, se pierde tu progreso.')) return;
              if (prompt('Escribí BORRAR para confirmar') !== 'BORRAR') return;
              await db.delete();
              location.reload();
            }}>Borrar datos de este dispositivo</Button>
          </div>
          <p className="mt-4 text-xs text-muted">C2 Recall v{__APP_VERSION__} · banco inicial {seedVersion} · FSRS (ts-fsrs) · datos guardados en IndexedDB de este dispositivo.</p>
        </Panel>
      </div>
    </div>
  );
}

function VoiceSettings({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    const t = setTimeout(load, 800);
    return () => clearTimeout(t);
  }, []);
  if (!speechAvailable()) return null;
  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle title="Pronunciación" subtitle="Usa las voces del sistema: funciona sin conexión y no tiene costo." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Voz en inglés">
          <select className={inputClass} value={s.voiceURI ?? ''} onChange={(e) => set({ voiceURI: e.target.value || undefined })}>
            <option value="">Automática (preferencia británica)</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </Field>
        <Field label={`Velocidad: ${s.speechRate.toFixed(2)}`}>
          <input type="range" min={0.6} max={1.2} step={0.05} value={s.speechRate} onChange={(e) => set({ speechRate: Number(e.target.value) })} className="w-full" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Toggle checked={s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} label="Leer la respuesta al revelarla" />
        <Button size="sm" icon={<Volume2 size={16} />} onClick={() => speak('It suddenly dawned on me that the new approach had worked like magic.', { rate: s.speechRate, voiceURI: s.voiceURI })}>Probar</Button>
      </div>
    </Panel>
  );
}

function SyncSettings() {
  const sync = useSyncStatus();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfgUrl, setCfgUrl] = useState('');
  const [cfgKey, setCfgKey] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ token_hash: string; label: string; created_at: string; last_used_at: string | null }[]>([]);
  const [cfgSource, setCfgSource] = useState<'build' | 'device' | null>(null);

  useEffect(() => { void getSupabaseConfig().then((c) => setCfgSource(c?.source ?? null)); }, [sync.state]);
  useEffect(() => { if (sync.state === 'idle') void listImportTokens().then(setTokens).catch(() => {}); }, [sync.state]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle title="Cuenta y sincronización" subtitle="Opcional y gratuita (Supabase). Sin ella, todo funciona igual en este dispositivo." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip tone={sync.state === 'idle' ? 'sage' : sync.state === 'error' ? 'coral' : sync.state === 'offline' ? 'amber' : 'neutral'} icon={<Cloud size={12} />}>
          {sync.state === 'unconfigured' ? 'Sincronización no configurada: modo local' : sync.state === 'signed-out' ? 'Configurada · sin sesión' : sync.state === 'syncing' ? 'Sincronizando…' : sync.state === 'offline' ? 'Sin conexión: se sincroniza al volver' : sync.state === 'error' ? 'Error' : 'Activa'}
        </Chip>
        {sync.email && <Chip>{sync.email}</Chip>}
        {sync.lastSyncAt && <Chip>última: {formatDate(sync.lastSyncAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Chip>}
        <Chip tone={sync.pending ? 'amber' : 'neutral'}>{sync.pending} cambios pendientes</Chip>
      </div>
      {sync.error && <p className="mb-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{sync.error}</p>}

      {sync.state === 'unconfigured' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Para usar la misma biblioteca en la notebook y el iPhone, creá un proyecto gratuito en Supabase (sin tarjeta) y pegá acá su URL y su clave pública <i>anon</i>. La guía paso a paso está en el README del proyecto.</p>
          <Field label="Project URL"><input className={inputClass} value={cfgUrl} onChange={(e) => setCfgUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" /></Field>
          <Field label="Clave pública (anon / publishable)"><input className={inputClass} value={cfgKey} onChange={(e) => setCfgKey(e.target.value)} placeholder="eyJhbGciOi… o sb_publishable_…" autoCapitalize="off" /></Field>
          <Button variant="primary" disabled={!cfgUrl.startsWith('https://') || cfgKey.length < 20} onClick={() => void run(() => saveDeviceSupabaseConfig({ url: cfgUrl.trim(), anonKey: cfgKey.trim() }))}>Guardar configuración</Button>
        </div>
      )}

      {sync.state === 'signed-out' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => signIn(email, password)); }}>
          <Field label="Email"><input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
          <Field label="Contraseña"><input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required minLength={6} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Spinner /> : undefined}>Iniciar sesión</Button>
            <Button disabled={busy} onClick={() => void run(async () => { const r = await signUp(email, password); toast(r === 'confirm-email' ? 'Cuenta creada: confirmá el email y después iniciá sesión' : 'Cuenta creada y sesión iniciada', r === 'confirm-email' ? 'info' : 'success'); })}>Crear cuenta</Button>
            {cfgSource === 'device' && <Button variant="ghost" onClick={() => void run(() => saveDeviceSupabaseConfig(null))}>Quitar configuración</Button>}
          </div>
        </form>
      )}

      {(sync.state === 'idle' || sync.state === 'syncing' || sync.state === 'offline' || sync.state === 'error') && sync.email && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<RefreshCw size={16} className={sync.state === 'syncing' ? 'animate-spin' : ''} />} onClick={() => void syncNow()}>Sincronizar ahora</Button>
            <Button icon={<LogOut size={16} />} onClick={() => void signOut()}>Cerrar sesión</Button>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound size={16} /> Integración directa (Método 2)</p>
            <p className="mt-1 text-sm text-muted">Un token permite que una herramienta autorizada deje lotes en tu bandeja de importación. Se muestra una sola vez; podés revocarlo cuando quieras.</p>
            <Button className="mt-3" size="sm" onClick={() => void run(async () => { setToken(await createImportToken(`Token ${new Date().toLocaleDateString('es-AR')}`)); setTokens(await listImportTokens()); })}>Crear token de importación</Button>
            {token && (
              <div className="mt-3 rounded-2xl bg-amber-soft p-3 text-sm">
                <p className="font-medium text-amber">Copialo ahora (no se vuelve a mostrar):</p>
                <code className="mt-1 block break-all font-mono text-[12px] text-ink">{token}</code>
                <p className="mt-2 text-xs text-ink-2">Endpoint: <code className="break-all">POST {(sync.config?.url ?? '')}/rest/v1/rpc/submit_import</code> con los encabezados <code>apikey</code> (clave pública) y <code>Content-Type: application/json</code>, y el cuerpo {'{ "token": "…", "title": "…", "payload": { "format": "c2-recall/v1", "items": [ … ] } }'}.</p>
              </div>
            )}
            {tokens.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {tokens.map((t) => (
                  <li key={t.token_hash} className="flex items-center justify-between gap-2">
                    <span className="text-ink-2">{t.label} · {t.last_used_at ? `usado ${formatDate(t.last_used_at)}` : 'sin uso'}</span>
                    <Button size="sm" variant="ghost" onClick={() => void run(async () => { await revokeImportToken(t.token_hash); setTokens(await listImportTokens()); })}>Revocar</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>}
    </Panel>
  );
}

function BackupSettings({ lastBackup }: { lastBackup: string | null }) {
  const toast = useToast();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const stamp = () => new Date().toISOString().slice(0, 10);
  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle title="Copias de seguridad" subtitle={lastBackup ? `Última copia: ${formatDate(lastBackup)}` : 'Todavía no descargaste ninguna copia.'} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Download size={16} />} onClick={async () => { download(`c2-recall-backup-${stamp()}.json`, await exportAll()); await setMeta('lastBackupAt', new Date().toISOString()); toast('Copia completa descargada'); }}>Exportar todo (JSON)</Button>
        <Button icon={<Download size={16} />} onClick={async () => download(`c2-recall-conocimientos-${stamp()}.csv`, knowledgeCsv(await db.knowledge.toArray()), 'text/csv')}>Conocimientos (CSV)</Button>
        <Button icon={<Download size={16} />} onClick={async () => { const states = new Map((await db.cardStates.toArray()).map((x) => [x.cardId, x])); download(`c2-recall-tarjetas-${stamp()}.csv`, cardsCsv(await db.cards.toArray(), states), 'text/csv'); }}>Tarjetas (CSV)</Button>
        <Button icon={<Download size={16} />} onClick={async () => download(`c2-recall-repasos-${stamp()}.csv`, reviewsCsv(await db.reviews.toArray()), 'text/csv')}>Repasos (CSV)</Button>
      </div>
      <div className="mt-4 rounded-2xl border border-line p-4">
        <p className="text-sm font-semibold text-ink">Restaurar una copia</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Combinar (conserva lo más reciente)</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Reemplazar todo</label>
        </div>
        <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          <Upload size={16} /> Elegir archivo .json
          <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (mode === 'replace' && !confirm('Se reemplazarán todos los datos de este dispositivo por los de la copia. ¿Continuar?')) return;
            try { const r = await restoreBackup(await f.text(), mode); toast(`Copia restaurada: ${r.knowledge} conocimientos, ${r.cards} tarjetas, ${r.reviews} repasos`); } catch (err) { toast((err as Error).message, 'error'); }
          }} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted">Aunque uses sincronización, descargá una copia de vez en cuando: es tu respaldo independiente de cualquier servicio.</p>
    </Panel>
  );
}

