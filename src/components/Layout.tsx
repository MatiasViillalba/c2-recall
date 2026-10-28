import { NavLink, Outlet } from 'react-router-dom';
import { GalleryVerticalEnd, Settings as SettingsIcon } from 'lucide-react';
import { cx } from './ui';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9 rounded-[11px] shadow-soft" />
      <span className="font-display text-[19px] font-semibold tracking-tight text-ink">C2 Recall</span>
    </div>
  );
}

const TABS = [
  { to: '/', label: 'Flashcards', icon: GalleryVerticalEnd, end: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function Layout() {
  return (
    <>
      <main className="min-w-0">
        <Outlet />
      </main>
      <nav className="tab-bar" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('tab', isActive && 'is-active')}>
            <Icon size={21} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
