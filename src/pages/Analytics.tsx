import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3 } from 'lucide-react';
import { useSettings } from '../lib/hooks';
import { loadOverview } from '../lib/overview';
import { CATEGORY_LABELS, PART_LABELS } from '../lib/labels';
import { Bars, HBar, Heatmap, StackedBar } from '../components/charts';
import { Chip, cx, EmptyState, PageHeader, Panel, SectionTitle, Stat } from '../components/ui';

export default function Analytics() {
  const settings = useSettings();
  const [range, setRange] = useState<30 | 90 | 182>(30);
  const data = useLiveQuery(() => loadOverview(settings, 182), [settings.dayStartsAtHour, settings.retention]);
  if (!data) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="skeleton h-64 rounded-3xl" /></div>;
  const a = data.analytics;
  const days = a.days.slice(-range);
  const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader eyebrow="Progreso" title="Estadísticas" subtitle="Calculadas en tu dispositivo a partir de tu historial de repasos y de FSRS." />

      {a.totalReviews === 0 && (
        <div className="mb-6">
          <EmptyState icon={<BarChart3 size={24} />} title="Todavía no hay repasos">Cuando completes tu primera sesión vas a ver acá tu retención, tu racha, el pronóstico y los conocimientos más difíciles.</EmptyState>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger">
        <Stat label="Retención real (30 d)" value={pct(a.retention30)} sub={`${a.trueRetentionCount} repasos de tarjetas maduras/jóvenes`} />
        <Stat label="Recuerdo estimado hoy" value={pct(a.estimatedRecall)} sub="promedio FSRS de tarjetas en repaso" />
        <Stat label="Racha" value={`${a.streak} d`} sub={`máxima: ${a.longestStreak} d · ${a.studiedDays} días estudiados`} />
        <Stat label="Repasos totales" value={a.totalReviews.toLocaleString('es-AR')} sub={`${Math.round(a.totalTimeMs / 60000)} min de estudio`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="p-5">
          <SectionTitle
            title="Repasos por día"
            subtitle="Barras rojas: respuestas «Again»"
            action={
              <div className="flex rounded-xl bg-surface-2 p-0.5 text-xs font-medium">
                {([30, 90, 182] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)} className={cx('rounded-lg px-2.5 py-1', range === r ? 'bg-surface text-ink shadow-soft' : 'text-muted')}>{r === 182 ? '6 m' : `${r} d`}</button>
                ))}
              </div>
            }
          />
          <Bars data={days.map((d) => ({ label: d.day, value: d.reviews, sub: d.reviews - d.correct }))} height={150} formatLabel={(l) => fmtDay(l)} />
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Estado de las tarjetas" subtitle={`${a.counts.total} tarjetas activas`} />
          <StackedBar parts={[
            { label: 'Nuevas', value: a.counts.new, color: 'var(--sky)' },
            { label: 'Aprendiendo', value: a.counts.learning, color: 'var(--amber)' },
            { label: 'Reaprendiendo', value: a.counts.relearning, color: 'var(--coral)' },
            { label: 'Jóvenes (<21 d)', value: a.counts.young, color: 'var(--lavender)' },
            { label: 'Maduras (≥21 d)', value: a.counts.mature, color: 'var(--sage)' },
          ]} />
          {a.counts.suspended > 0 && <p className="mt-3 text-xs text-muted">{a.counts.suspended} suspendidas (no cuentan).</p>}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle title="Pronóstico" subtitle="Tarjetas que vencen en los próximos 30 días" />
          <Bars data={a.forecast.map((f) => ({ label: f.day, value: f.due }))} color="var(--sky)" height={130} formatLabel={(l, i) => (i === 0 ? 'hoy' : fmtDay(l))} />
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Heatmap de estudio" subtitle="Últimos 6 meses" />
          <Heatmap days={a.days} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle title="Progreso por parte del examen" subtitle="Estudiados y maduros sobre el total" />
          {a.byPart.filter((p) => p.key !== 'GEN').map((p) => (
            <HBar key={p.key} label={PART_LABELS[p.key].long} value={p.studied} total={p.total} sub={`${p.studied}/${p.total} · ${p.mature} maduros`} tone="var(--lavender)" />
          ))}
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Progreso por categoría" />
          <div className="max-h-[360px] overflow-y-auto pr-1">
            {a.byCategory.map((c) => (
              <HBar key={c.key} label={CATEGORY_LABELS[c.key]} value={c.studied} total={c.total} sub={`${c.studied}/${c.total} · ${c.mature} maduros`} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle title="Conocimientos más difíciles" subtitle="Según fallos y dificultad FSRS" />
          {a.hardest.length ? (
            <ul className="divide-y divide-line">
              {a.hardest.slice(0, 12).map((h) => {
                const k = data.knowledgeById.get(h.knowledgeId);
                return k ? (
                  <li key={h.knowledgeId}><Link to={`/library/${encodeURIComponent(k.id)}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                    <span className="truncate font-display">{k.expression}</span>
                    <span className="flex shrink-0 gap-1"><Chip tone="coral">{h.lapses} fallos</Chip><Chip>D {h.difficulty.toFixed(1)}</Chip></span>
                  </Link></li>
                ) : null;
              })}
            </ul>
          ) : <p className="text-sm text-muted">Sin datos todavía.</p>}
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Errores recurrentes" subtitle="Veces que lo fallaste en ejercicios y simulacros" />
          <ul className="divide-y divide-line">
            {a.recurring.slice(0, 12).map((r) => {
              const k = data.knowledgeById.get(r.knowledgeId);
              return k ? (
                <li key={r.knowledgeId}><Link to={`/library/${encodeURIComponent(k.id)}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                  <span className="truncate font-display">{k.expression}</span>
                  <Chip tone="coral">{r.timesMissed}×</Chip>
                </Link></li>
              ) : null;
            })}
          </ul>
        </Panel>
      </div>

      {a.monthly.length > 0 && (
        <Panel className="mt-4 mb-8 p-5">
          <SectionTitle title="Evolución mensual" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {a.monthly.map((m) => (
              <div key={m.month} className="rounded-2xl bg-surface-2 px-3 py-2.5">
                <div className="text-xs text-muted">{new Date(m.month + '-15').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}</div>
                <div className="text-lg font-semibold tabular-nums">{m.reviews}</div>
                <div className="text-xs text-muted">retención {pct(m.retention)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
