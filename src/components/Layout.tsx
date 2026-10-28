import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, BookOpen, CloudOff, Cloud, Home, Layers, LayoutGrid, Loader2, PlusCircle, Settings as SettingsIcon, Sparkles, RefreshCw,
} from 'lucide-react';
import { useSyncStatus } from '../lib/hooks';
import { syncNow } from '../lib/sync';
import { cx } from './ui';
import { relativeDue } from '../lib/util';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/study', label: 'Estudiar', icon: Sparkles },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/decks', label: 'Mazos', icon: Layers },
  { to: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { to: '/add', label: 'Agregar', icon: PlusCircle },
  { to: '/settings', label: 'Ajustes', icon: SettingsIcon },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9 rounded-[11px] shadow-soft" />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold text-ink">C2 Recall</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Cambridge Proficiency</div>
        </div>
      )}
    </div>
  );
}

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSyncStatus();
  const label =
    s.state === 'unconfigured' ? 'Solo en este dispositivo'
      : s.state === 'signed-out' ? 'Sin sesión: solo local'
        : s.state === 'syncing' ? 'Sincronizando…'
          : s.state === 'offline' ? `Sin conexión · ${s.pending} pendientes`
            : s.state === 'error' ? 'Error de sincronización'
              : s.pending ? `${s.pending} cambios por subir` : `Sincronizado${s.lastSyncAt ? ` ${relativeAgo(s.lastSyncAt)}` : ''}`;
  const Icon = s.state === 'syncing' ? Loader2 : s.state === 'idle' ? Cloud : s.state === 'error' ? RefreshCw : CloudOff;
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={s.error ?? label}
      className={cx(
        'flex items-center gap-2 rounded-xl text-left text-xs font-medium transition hover:bg-surface-2',
        compact ? 'p-2' : 'w-full px-3 py-2',
        s.state === 'error' ? 'text-coral' : s.state === 'idle' ? 'text-sage' : 'text-muted',
      )}
    >
      <Icon size={16} className={cx('shrink-0', s.state === 'syncing' && 'animate-spin')} />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  );
}

function relativeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'ahora';
  const r = relativeDue(new Date(Date.now() + diff).toISOString());
  return `hace ${r.replace('en ', '')}`;
}

export function Layout() {
  const location = useLocation();
  const focusMode = location.pathname.startsWith('/study/session');
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {!focusMode && (
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg-2/60 px-4 py-6 lg:flex">
          <div className="px-2"><Logo /></div>
          <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Principal">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => cx(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition',
                  isActive ? 'bg-surface text-ink shadow-soft' : 'text-ink-2 hover:bg-surface/70',
                )}
              >
                <Icon size={19} strokeWidth={1.9} />
                {label}
              </NavLink>
            ))}
          </nav>
          <SyncBadge />
        </aside>
      )}
      <main className={cx('min-w-0', focusMode ? 'lg:col-span-2' : 'pb-nav')}>
        <Outlet />
      </main>
      {!focusMode && <BottomNav />}
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Inicio', icon: Home, end: true },
    { to: '/library', label: 'Biblioteca', icon: BookOpen },
    { to: '/study', label: 'Estudiar', icon: Sparkles, primary: true },
    { to: '/stats', label: 'Progreso', icon: BarChart3 },
    { to: '/more', label: 'Más', icon: LayoutGrid },
  ];
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-2">
        {items.map(({ to, label, icon: Icon, end, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx(
              'flex h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
              isActive ? 'text-primary' : 'text-muted',
            )}
          >
            {({ isActive }) =>
              primary ? (
                <>
                  <span className={cx('flex h-11 w-11 items-center justify-center rounded-2xl shadow-soft transition', isActive ? 'bg-primary text-primary-ink' : 'bg-primary text-primary-ink opacity-95')}>
                    <Icon size={21} />
                  </span>
                </>
              ) : (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                  <span>{label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
