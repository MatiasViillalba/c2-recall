import { Outlet } from 'react-router-dom';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8 rounded-[10px] shadow-soft" />
      <span className="font-display text-[17px] font-semibold text-ink">C2 Recall</span>
    </div>
  );
}

export function Layout() {
  return (
    <main className="min-w-0">
      <Outlet />
    </main>
  );
}
