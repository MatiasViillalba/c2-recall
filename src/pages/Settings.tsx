import { useEffect, useState, type ReactNode } from 'react';
import { Download, LogOut, Monitor, Moon, RefreshCw, Sun, Upload } from 'lucide-react';
import { useSettings, useSyncStatus } from '../lib/hooks';
import { recomputeAllStates, saveSettings } from '../lib/repo';
import { exportAll, restoreBackup } from '../lib/backup';
import { getSupabaseConfig, saveDeviceSupabaseConfig, signIn, signOut, signUp, syncNow } from '../lib/sync';
import { fetchSeed, installSeed } from '../lib/seed';
import { db, setMeta } from '../lib/db';
import { Button, cx, inputClass, Spinner } from '../components/ui';
import { useToast } from '../components/toast';
import { download } from '../lib/util';

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="rounded-[26px] border border-line bg-surface/90 p-5 shadow-soft backdrop-blur-xl">{children}</div>
      {note && <p className="mt-2 px-1 text-[13px] leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const toast = useToast();

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden><span /><span /><span /></div>
      <div className="relative mx-auto max-w-xl px-4 pb-tabs pt-[calc(env(safe-area-inset-top)+18px)] sm:px-6 sm:pt-10">
        <header className="mb-8">
          <h1 className="font-display text-[34px] font-semibold tracking-tight text-ink">Settings</h1>
        </header>

        <div className="space-y-8">
          <Group title="Appearance">
            <div className="grid grid-cols-3 gap-2">
              {([['system', 'Auto', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => void saveSettings({ theme: v })}
                  className={cx(
                    'flex flex-col items-center gap-2 rounded-2xl border py-4 text-sm font-medium transition',
                    s.theme === v ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-2 hover:bg-surface-2',
                  )}
                >
                  <Icon size={19} />{label}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Daily study" note="Like Anki: reviews come back when they are due, and new cards are introduced up to your daily limit. Higher retention means cards return sooner and more often.">
            <label className="mb-6 block">
              <div className="mb-3 flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">New cards per day</span>
                <span className="tabular-nums text-ink-2">{s.newPerDay}</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={s.newPerDay} onChange={(e) => void saveSettings({ newPerDay: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="block">
              <div className="mb-3 flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">Target retention</span>
                <span className="tabular-nums text-ink-2">{Math.round(s.retention * 100)}%</span>
              </div>
              <input type="range" min={0.8} max={0.97} step={0.01} value={s.retention} onChange={(e) => void saveSettings({ retention: Number(e.target.value) })} className="w-full" />
            </label>
          </Group>

          <SyncSettings />

          <Group title="Backup" note="Your progress lives on this device (and in the cloud if sync is on). A backup file is an extra safety net.">
            <div className="flex flex-wrap gap-2">
              <Button icon={<Download size={16} />} onClick={async () => {
                download(`c2-recall-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll());
                await setMeta('lastBackupAt', new Date().toISOString());
                toast('Backup downloaded');
              }}>Download backup</Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2">
                <Upload size={16} /> Restore backup
                <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const r = await restoreBackup(await f.text(), 'merge');
                    toast(`Restored ${r.cards} cards and ${r.reviews} reviews`);
                  } catch (err) {
                    toast((err as Error).message, 'error');
                  }
                }} />
              </label>
            </div>
          </Group>

          <Group title="Maintenance">
            <div className="flex flex-wrap gap-2">
              <Button icon={<RefreshCw size={16} />} onClick={async () => { await recomputeAllStates(); toast('Schedule rebuilt from your review history'); }}>Rebuild schedule</Button>
              <Button onClick={async () => { const r = await installSeed(await fetchSeed(), { force: true }); toast(`Card bank refreshed: +${r.cardsAdded} cards`); }}>Refresh card bank</Button>
              <Button variant="danger" onClick={async () => {
                if (!confirm('Erase ALL data on this device? Without sync or a backup, your progress is lost.')) return;
                if (prompt('Type ERASE to confirm') !== 'ERASE') return;
                await db.delete();
                location.reload();
              }}>Erase this device</Button>
            </div>
            <p className="mt-4 text-xs text-faint">C2 Recall v{__APP_VERSION__}</p>
          </Group>
        </div>
      </div>
    </div>
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
  const [cfgSource, setCfgSource] = useState<'build' | 'device' | null>(null);

  useEffect(() => { void getSupabaseConfig().then((c) => setCfgSource(c?.source ?? null)); }, [sync.state]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const status =
    sync.state === 'unconfigured' ? 'Off — this device only'
      : sync.state === 'signed-out' ? 'Signed out'
        : sync.state === 'syncing' ? 'Syncing…'
          : sync.state === 'offline' ? 'Offline — will sync when back online'
            : sync.state === 'error' ? 'Sync error'
              : 'On';
  const dot = sync.state === 'idle' || sync.state === 'syncing' ? 'bg-sage' : sync.state === 'error' ? 'bg-coral' : 'bg-faint';

  return (
    <Group title="Sync" note="Keeps your iPhone and laptop on the same progress.">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-ink"><span className={cx('h-2 w-2 rounded-full', dot)} />{status}</span>
        {sync.email && <span className="truncate text-muted">{sync.email}</span>}
      </div>
      {sync.error && <p className="mb-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{sync.error}</p>}

      {sync.state === 'unconfigured' && (
        <div className="space-y-3">
          <input className={inputClass} value={cfgUrl} onChange={(e) => setCfgUrl(e.target.value)} placeholder="Supabase project URL" autoCapitalize="off" />
          <input className={inputClass} value={cfgKey} onChange={(e) => setCfgKey(e.target.value)} placeholder="Publishable (anon) key" autoCapitalize="off" />
          <Button variant="primary" disabled={!cfgUrl.startsWith('https://') || cfgKey.length < 20} onClick={() => void run(() => saveDeviceSupabaseConfig({ url: cfgUrl.trim(), anonKey: cfgKey.trim() }))}>Save</Button>
        </div>
      )}

      {sync.state === 'signed-out' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => signIn(email, password)); }}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required minLength={6} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Spinner /> : undefined}>Sign in</Button>
            <Button disabled={busy} onClick={() => void run(async () => {
              const r = await signUp(email, password);
              toast(r === 'confirm-email' ? 'Account created: confirm your email, then sign in' : 'Account created', r === 'confirm-email' ? 'info' : 'success');
            })}>Create account</Button>
            {cfgSource === 'device' && <Button variant="ghost" onClick={() => void run(() => saveDeviceSupabaseConfig(null))}>Remove setup</Button>}
          </div>
        </form>
      )}

      {sync.state !== 'unconfigured' && sync.state !== 'signed-out' && sync.email && (
        <div className="flex flex-wrap gap-2">
          <Button icon={<RefreshCw size={16} className={sync.state === 'syncing' ? 'animate-spin' : ''} />} onClick={() => void syncNow()}>Sync now</Button>
          <Button variant="ghost" icon={<LogOut size={16} />} onClick={() => void signOut()}>Sign out</Button>
        </div>
      )}
      {error && <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>}
    </Group>
  );
}
