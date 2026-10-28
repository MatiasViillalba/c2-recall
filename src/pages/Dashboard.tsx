import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Brain, CalendarDays, Clock3, Flame, Layers, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { useSettings } from '../lib/hooks';
import { loadOverview } from '../lib/overview';
import { Button, Chip, Panel, ProgressRing, SectionTitle } from '../components/ui';
import { Bars } from '../components/charts';
import { SyncBadge, Logo } from '../components/Layout';
import { db } from '../lib/db';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function minutes(ms: number) {
  return Math.round(ms / 60000);
}

export default function Dashboard() {
  const settings = useSettings();
  const navigate = useNavigate();
  const data = useLiveQuery(() => loadOverview(settings, 120), [settings.newPerDay, settings.reviewsPerDay, settings.retention, settings.dayStartsAtHour]);
  const flagged = useLiveQuery(() => db.cards.filter((c) => !!c.flagged && !c.deleted).count(), []);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 lg:pt-10">
        <div className="skeleton h-12 w-64 rounded-2xl" />
        <div className="skeleton mt-6 h-56 rounded-3xl" />
      </div>
    );
  }

  const { analytics: a, queue, today, totals } = data;
  const dueNow = queue.review + queue.learning;
  const sessionSize = dueNow + queue.new;
  const estMin = Math.max(1, Math.round(sessionSize * 0.35));
  const goal = settings.dailyGoalMinutes;
  const doneMin = minutes(today.timeMs);
  const name = settings.displayName ?? 'Matías';
  const examDays = settings.examDate ? Math.ceil((new Date(settings.examDate).getTime() - Date.now()) / 86_400_000) : null;
  const weekLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const hardest = a.hardest.slice(0, 5).map((h) => ({ ...h, k: data.knowledgeById.get(h.knowledgeId) })).filter((h) => h.k);
  const recurring = a.recurring.slice(0, 5).map((r) => ({ ...r, k: data.knowledgeById.get(r.knowledgeId) })).filter((r) => r.k);
  const matureTotal = a.counts.mature + a.counts.young;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] sm:px-8 lg:pt-10">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <Logo compact />
        <SyncBadge compact />
      </div>

      <header className="mb-6 anim-rise">
        <p className="text-sm font-medium text-muted">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="font-display text-[2.1rem] font-medium leading-tight text-ink sm:text-5xl">{greeting()}, {name}.</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted">
          <Target size={16} className="text-lavender" /> Objetivo: <span className="font-medium text-ink-2">Grade A en C2 Proficiency</span>
          {examDays !== null && examDays > 0 && <Chip tone="lavender">faltan {examDays} días</Chip>}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] stagger">
        {/* Tarjeta principal */}
        <Panel className="relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lavender-soft blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-sage-soft blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted">Para hoy</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-display text-6xl font-medium tabular-nums text-ink">{sessionSize}</span>
                  <span className="text-muted">tarjetas</span>
                </div>
              </div>
              <ProgressRing value={goal ? doneMin / goal : 0} size={72} tone="var(--lavender)">
                <div className="text-center leading-none">
                  <div className="text-sm font-semibold text-ink">{doneMin}</div>
                  <div className="text-[10px] text-muted">/{goal} min</div>
                </div>
              </ProgressRing>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="coral" icon={<Clock3 size={12} />}>{dueNow} para repasar</Chip>
              <Chip tone="sky" icon={<Sparkles size={12} />}>{queue.new} nuevas</Chip>
              {queue.learning > 0 && <Chip tone="amber">{queue.learning} en aprendizaje</Chip>}
              <Chip>≈ {estMin} min</Chip>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" variant="primary" onClick={() => navigate('/study/session?mode=scheduled')} disabled={!sessionSize} icon={<Sparkles size={20} />}>
                {sessionSize ? 'Empezar a estudiar' : 'Todo al día'}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/study')} icon={<Layers size={19} />}>Otras sesiones</Button>
            </div>
            {!sessionSize && (
              <p className="mt-4 text-sm text-muted">
                No hay tarjetas pendientes. Si querés seguir, probá el <Link className="font-medium text-primary" to="/study/session?mode=errors">repaso intensivo de errores</Link> o subí el límite de nuevas en Ajustes.
              </p>
            )}
          </div>
        </Panel>

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-4">
          <Metric icon={<Flame size={18} />} tone="text-amber bg-amber-soft" label="Racha" value={`${a.streak}`} sub={a.streak === 1 ? 'día' : 'días'} />
          <Metric icon={<Brain size={18} />} tone="text-sage bg-sage-soft" label="Retención" value={a.retention30 !== null ? `${Math.round(a.retention30 * 100)}%` : a.estimatedRecall !== null ? `${Math.round(a.estimatedRecall * 100)}%` : '—'} sub={a.retention30 !== null ? 'últimos 30 días' : a.estimatedRecall !== null ? 'estimada (FSRS)' : 'sin datos aún'} />
          <Metric icon={<Zap size={18} />} tone="text-lavender bg-lavender-soft" label="Repasadas hoy" value={`${today.done}`} sub={`${today.newDone} nuevas · ${today.again} «Again»`} />
          <Metric icon={<Clock3 size={18} />} tone="text-sky bg-sky-soft" label="Tiempo hoy" value={`${doneMin} min`} sub={`${Math.round(a.totalTimeMs / 3_600_000)} h en total`} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3 stagger">
        <Panel className="p-5 lg:col-span-2">
          <SectionTitle title="Progreso semanal" subtitle={`${a.week.reduce((n, d) => n + d.reviews, 0)} repasos en los últimos 7 días`} action={<Link to="/stats" className="flex items-center gap-1 text-sm font-medium text-primary">Estadísticas <ArrowRight size={15} /></Link>} />
          <Bars
            data={a.week.map((d) => ({ label: d.day, value: d.reviews }))}
            height={120}
            highlightLast
            formatLabel={(l) => weekLabels[(new Date(l + 'T12:00:00').getDay() + 6) % 7]}
          />
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <MiniStat label="Conocimientos" value={totals.knowledge} />
            <MiniStat label="Tarjetas activas" value={totals.cards} />
            <MiniStat label="Aprendidas" value={matureTotal} sub={`${a.counts.mature} maduras`} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Conocimientos difíciles" subtitle="Los que más te cuestan" />
          {hardest.length || recurring.length ? (
            <ul className="space-y-1">
              {(hardest.length ? hardest : recurring).map((h) => (
                <li key={h.knowledgeId}>
                  <Link to={`/library/${encodeURIComponent(h.knowledgeId)}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                    <span className="truncate font-display text-[15px] text-ink">{h.k!.expression}</span>
                    <Chip tone="coral">{'lapses' in h ? `${h.lapses} fallos` : `${(h as { timesMissed: number }).timesMissed}×`}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todavía no hay datos de repaso. A medida que estudies, acá vas a ver lo que más se te resiste.</p>
          )}
          <Button className="mt-4" block variant="soft" onClick={() => navigate('/study/session?mode=errors')} icon={<TrendingUp size={18} />}>
            Repaso intensivo de errores
          </Button>
          <p className="mt-2 text-center text-xs text-muted">{totals.errors} conocimientos vienen de errores tuyos</p>
        </Panel>
      </div>

      {(flagged ?? 0) > 0 && (
        <Panel className="mt-4 flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-ink-2">Tenés {flagged} tarjeta(s) reportadas para revisar.</span>
          <Button size="sm" variant="soft" onClick={() => navigate('/library?flagged=1')}>Revisar</Button>
        </Panel>
      )}

      <div className="mt-6 mb-4 flex items-center justify-center gap-2 text-xs text-muted">
        <CalendarDays size={14} /> El día de estudio empieza a las {settings.dayStartsAtHour}:00 · FSRS con retención objetivo {Math.round(settings.retention * 100)}%
      </div>
    </div>
  );
}

function Metric({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: string }) {
  return (
    <Panel className="flex flex-col justify-between p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <div className="mt-3">
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <div className="text-xl font-semibold tabular-nums text-ink">{value.toLocaleString('es-AR')}</div>
      <div className="text-[11px] text-muted">{label}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
