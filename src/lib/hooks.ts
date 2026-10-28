import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS } from './scheduler';
import { getSyncStatus, subscribeSync } from './sync';
import type { Settings } from './types';

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('settings'), []);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setMatch(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return match;
}

/** Aplica el tema elegido (system/light/dark) al documento. */
export function useApplyTheme(theme: Settings['theme']) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('c2r-theme', theme); } catch { /* sin almacenamiento */ }
    // La barra de estado queda siempre negra, con tema claro u oscuro.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', '#000000'));
  }, [theme, prefersDark]);
}
