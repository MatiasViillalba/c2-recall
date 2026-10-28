// Gráficos livianos en SVG (sin librerías): barras, heatmap de estudio y barras horizontales.
import { useState } from 'react';
import { cx } from './ui';

export function Bars({
  data, height = 140, color = 'var(--lavender)', highlightLast, formatLabel, valueLabel,
}: {
  data: { label: string; value: number; sub?: number }[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
  formatLabel?: (label: string, i: number) => string;
  valueLabel?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${n * 10} ${height}`} preserveAspectRatio="none" className="h-[var(--h)] w-full" style={{ ['--h' as string]: `${height}px` }} role="img" aria-label="Gráfico de barras">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={n * 10} y1={height * g} y2={height * g} stroke="var(--line)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 6);
          const sh = d.sub ? (d.sub / max) * (height - 6) : 0;
          const active = hover === i || (highlightLast && hover === null && i === n - 1);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
              <rect x={i * 10} y={0} width={10} height={height} fill="transparent" />
              <rect x={i * 10 + 1.6} y={height - h} width={6.8} height={Math.max(h, d.value ? 1.5 : 0)} rx={1.6} fill={color} opacity={active ? 1 : 0.55} />
              {sh > 0 && <rect x={i * 10 + 1.6} y={height - sh} width={6.8} height={sh} rx={1.6} fill="var(--coral)" opacity={active ? 0.95 : 0.6} />}
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{formatLabel ? formatLabel(data[0]?.label ?? '', 0) : data[0]?.label}</span>
        {hover !== null && data[hover] ? (
          <span className="font-medium text-ink">
            {formatLabel ? formatLabel(data[hover].label, hover) : data[hover].label}: {valueLabel ? valueLabel(data[hover].value) : data[hover].value}
          </span>
        ) : null}
        <span>{formatLabel ? formatLabel(data[n - 1]?.label ?? '', n - 1) : data[n - 1]?.label}</span>
      </div>
    </div>
  );
}

export function Heatmap({ days }: { days: { day: string; reviews: number }[] }) {
  // Columnas = semanas, filas = días (lunes a domingo).
  const max = Math.max(1, ...days.map((d) => d.reviews));
  const first = new Date(days[0]?.day + 'T12:00:00');
  const pad = (first.getDay() + 6) % 7;
  const cells: ({ day: string; reviews: number } | null)[] = [...Array(pad).fill(null), ...days];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const level = (v: number) => (v === 0 ? 0 : v < max * 0.25 ? 1 : v < max * 0.5 ? 2 : v < max * 0.8 ? 3 : 4);
  const fills = ['var(--surface-3)', 'color-mix(in srgb, var(--sage) 30%, var(--surface))', 'color-mix(in srgb, var(--sage) 55%, var(--surface))', 'color-mix(in srgb, var(--sage) 78%, var(--surface))', 'var(--sage)'];
  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="flex min-w-max gap-[3px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const c = w[di];
              return (
                <div
                  key={di}
                  title={c ? `${new Date(c.day + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}: ${c.reviews} repasos` : ''}
                  className="h-3 w-3 rounded-[3px]"
                  style={{ background: c ? fills[level(c.reviews)] : 'transparent' }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted">
        menos {fills.map((f, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: f }} />)} más
      </div>
    </div>
  );
}

export function HBar({ label, value, total, tone = 'var(--sage)', sub, className }: { label: string; value: number; total: number; tone?: string; sub?: string; className?: string }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className={cx('py-1.5', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-ink-2">{label}</span>
        <span className="shrink-0 tabular-nums text-muted">{sub ?? `${value}/${total}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone, transition: 'width 0.8s cubic-bezier(0.2,0.7,0.2,1)' }} />
      </div>
    </div>
  );
}

export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="tabular-nums text-muted">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
