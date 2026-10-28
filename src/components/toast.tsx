import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cx } from './ui';

type ToastTone = 'success' | 'info' | 'error';
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

const ToastCtx = createContext<(message: string, tone?: ToastTone, action?: Toast['action']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: ToastTone = 'success', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6500 : 3200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-lifted anim-pop',
            )}
            role="status"
          >
            {t.tone === 'success' && <CheckCircle2 size={18} className="shrink-0 text-sage" />}
            {t.tone === 'info' && <Info size={18} className="shrink-0 text-sky" />}
            {t.tone === 'error' && <TriangleAlert size={18} className="shrink-0 text-coral" />}
            <span>{t.message}</span>
            {t.action && (
              <button className="ml-1 shrink-0 font-semibold text-primary" onClick={() => { t.action!.onClick(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
