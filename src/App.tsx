import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Layout, Logo } from './components/Layout';
import { ToastProvider } from './components/toast';
import { Button } from './components/ui';
import { useApplyTheme, useSettings } from './lib/hooks';
import { ensureSeed } from './lib/seed';
import { initSync, startAutoSync } from './lib/sync';
import { db } from './lib/db';
import Flashcards from './pages/Flashcards';

const SettingsPage = lazy(() => import('./pages/Settings'));

function Boot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const count = await db.knowledge.count();
        if (!count) setFirstRun(true);
        const res = await ensureSeed();
        if (!count && !res) throw new Error('Could not load the card bank. Check your connection and reopen the app (only needed the first time).');
        if (navigator.storage?.persist) void navigator.storage.persist();
      } catch (e) {
        if (alive) setError((e as Error).message);
        return;
      }
      if (alive) setReady(true);
      void initSync().then(startAutoSync);
    })();
    return () => { alive = false; };
  }, []);
  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo />
        <p className="max-w-sm text-muted">{error}</p>
        <Button variant="primary" onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center anim-fade">
        <Logo />
        {firstRun && <p className="max-w-xs text-sm text-muted">Preparing your cards…</p>}
        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-3"><div className="skeleton h-full w-full" /></div>
      </div>
    );
  }
  return <>{children}</>;
}

function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-lifted anim-pop">
        <span>A new version is available.</span>
        <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>Update</Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>Later</Button>
      </div>
    </div>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  useApplyTheme(settings.theme);
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <div className="skeleton mb-4 h-10 w-40 rounded-2xl" />
      <div className="skeleton h-48 w-full rounded-3xl" />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Boot>
        <Themed>
          <UpdatePrompt />
          <HashRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Flashcards />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<Flashcards />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </Themed>
      </Boot>
    </ToastProvider>
  );
}
