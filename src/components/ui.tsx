// Componentes base accesibles (sin dependencias pesadas): botones, tarjetas, chips, diálogos, etc.
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:opacity-92 shadow-soft',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 shadow-soft',
  ghost: 'text-ink-2 hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary hover:brightness-97',
  danger: 'bg-coral-soft text-coral hover:brightness-97',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 active:scale-95 disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Panel({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-3xl border border-line bg-surface shadow-soft', className)}>{children}</As>;
}

const TONES = {
  neutral: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-soft text-primary',
  lavender: 'bg-lavender-soft text-lavender',
  sage: 'bg-sage-soft text-sage',
  amber: 'bg-amber-soft text-amber',
  coral: 'bg-coral-soft text-coral',
  sky: 'bg-sky-soft text-sky',
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = 'neutral', className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 anim-rise">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-lavender">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-medium text-ink sm:text-[2.4rem] sm:leading-tight">{title}</h1>
        {subtitle && <div className="mt-1.5 text-[15px] text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center anim-fade">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-soft text-lavender">{icon}</div>
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-surface-3')}
      >
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-faint outline-none transition focus:border-lavender focus:ring-4 focus:ring-lavender/15';

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={cx(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink shadow-lifted sm:m-auto sm:rounded-3xl',
        wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col anim-rise">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose}><X size={20} /></IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 safe-bottom">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, tone = 'var(--sage)', children }: { value: number; size?: number; stroke?: number; tone?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2,0.7,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

const TONE_TEXT: Record<Tone, string> = { neutral: 'text-ink', primary: 'text-primary', lavender: 'text-lavender', sage: 'text-sage', amber: 'text-amber', coral: 'text-coral', sky: 'text-sky' };

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cx('mt-0.5 text-2xl font-semibold tabular-nums', TONE_TEXT[tone ?? 'neutral'])}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden />;
}
