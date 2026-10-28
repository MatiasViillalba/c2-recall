import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, GraduationCap, Heart, Rocket, Shuffle, SlidersHorizontal, Sparkles, Target, Zap } from 'lucide-react';
import { useSettings } from '../lib/hooks';
import { buildScheduledQueue, loadLibrary, todayStats } from '../lib/queue';
import { Button, Chip, cx, Field, Modal, PageHeader, Panel, Toggle } from '../components/ui';
import { CATEGORY_LABELS, PART_LABELS } from '../lib/labels';
import { CATEGORIES, type Category, type ExamPart } from '../lib/types';
import { pluralize } from '../lib/util';

const PART_SHORTCUTS: { part: ExamPart; tone: string }[] = [
  { part: 'P4', tone: 'bg-primary-soft text-primary' },
  { part: 'P2', tone: 'bg-lavender-soft text-lavender' },
  { part: 'P3', tone: 'bg-sage-soft text-sage' },
  { part: 'P1', tone: 'bg-sky-soft text-sky' },
];

export default function StudyHome() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [customOpen, setCustomOpen] = useState(false);
  const data = useLiveQuery(async () => {
    const lib = await loadLibrary();
    const today = await todayStats(settings);
    const main = await buildScheduledQueue({ settings }, lib, today);
    const parts: Record<string, { due: number; fresh: number }> = {};
    for (const { part } of PART_SHORTCUTS) {
      const q = await buildScheduledQueue({ settings, filter: { parts: [part] } }, lib, today);
      parts[part] = { due: q.counts.review + q.counts.learning, fresh: q.counts.new };
    }
    return { main: main.counts, parts };
  }, [settings.newPerDay, settings.reviewsPerDay, settings.dayStartsAtHour]);

  const go = (q: string) => navigate(`/study/session?${q}`);
  const main = data?.main;
  const total = main ? main.review + main.learning + main.new : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader eyebrow="Estudiar" title="¿Qué practicamos hoy?" subtitle="La sesión del día sigue FSRS. Las sesiones de repaso intensivo no alteran tu programación." />

      <Panel className="relative overflow-hidden p-6 sm:p-8 anim-rise">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-lavender-soft blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-muted">Sesión del día</p>
            <p className="mt-1 font-display text-4xl text-ink">{total} tarjetas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="coral">{pluralize((main?.review ?? 0) + (main?.learning ?? 0), 'repaso', 'repasos')}</Chip>
              <Chip tone="sky">{pluralize(main?.new ?? 0, 'nueva', 'nuevas')}</Chip>
              <Chip>{main?.newAvailable ?? 0} conocimientos sin empezar</Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="primary" icon={<Sparkles size={20} />} disabled={!total} onClick={() => go('mode=scheduled')}>Empezar</Button>
            <Button size="lg" icon={<Rocket size={19} />} onClick={() => go('mode=scheduled&extraNew=10')} disabled={!main?.newAvailable}>+10 nuevas</Button>
          </div>
        </div>
      </Panel>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-ink">Por parte del examen</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger">
        {PART_SHORTCUTS.map(({ part, tone }) => {
          const c = data?.parts[part];
          const has = (c?.due ?? 0) + (c?.fresh ?? 0) > 0;
          return (
            <button
              key={part}
              type="button"
              onClick={() => go(has ? `mode=scheduled&parts=${part}` : `mode=custom&parts=${part}&size=25`)}
              className="group rounded-3xl border border-line bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <span className={cx('inline-flex rounded-xl px-2.5 py-1 text-xs font-semibold', tone)}>{part}</span>
              <p className="mt-3 font-display text-lg leading-tight text-ink">{PART_LABELS[part].short}</p>
              <p className="mt-1 text-xs text-muted">{has ? `${c?.due ?? 0} repasos · ${c?.fresh ?? 0} nuevas` : 'Al día · practicar igual'}</p>
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-ink">Otras sesiones</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
        <Option icon={<Flame size={20} />} tone="bg-coral-soft text-coral" title="Repaso intensivo de errores" text="Lo que fallaste en ejercicios, simulacros y repasos recientes. No toca la programación." onClick={() => go('mode=errors&size=30')} />
        <Option icon={<Target size={20} />} tone="bg-amber-soft text-amber" title="Tarjetas difíciles" text="Las que más olvidás según FSRS (fallos y dificultad alta)." onClick={() => go('mode=difficult&size=25')} />
        <Option icon={<Zap size={20} />} tone="bg-sky-soft text-sky" title="Repaso rápido" text="Hasta 20 tarjetas del día con reverso compacto, para ratos cortos." onClick={() => go('mode=scheduled&quick=1')} />
        <Option icon={<GraduationCap size={20} />} tone="bg-primary-soft text-primary" title="Modo examen" text="Sin pistas, sin etiquetas de parte ni categoría: como en el examen." onClick={() => go('mode=scheduled&exam=1')} />
        <Option icon={<Heart size={20} />} tone="bg-lavender-soft text-lavender" title="Favoritas" text="Las expresiones que marcaste con estrella." onClick={() => go('mode=favorites&size=40')} />
        <Option icon={<SlidersHorizontal size={20} />} tone="bg-sage-soft text-sage" title="Sesión personalizada" text="Elegí partes, categorías, tamaño y modo." onClick={() => setCustomOpen(true)} />
      </div>

      <CustomSession open={customOpen} onClose={() => setCustomOpen(false)} onStart={(q) => { setCustomOpen(false); go(q); }} />
    </div>
  );
}

function Option({ icon, title, text, onClick, tone }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; tone: string }) {
  return (
    <button type="button" onClick={onClick} className="flex gap-4 rounded-3xl border border-line bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted">
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone)}>{icon}</span>
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}

function CustomSession({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (query: string) => void }) {
  const [parts, setParts] = useState<ExamPart[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [exam, setExam] = useState(false);
  const [size, setSize] = useState(25);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const query = () => {
    const q = new URLSearchParams();
    q.set('mode', scheduled ? 'scheduled' : 'custom');
    if (parts.length) q.set('parts', parts.join(','));
    if (cats.length) q.set('cats', cats.join(','));
    if (exam) q.set('exam', '1');
    q.set('size', String(size));
    return q.toString();
  };
  return (
    <Modal open={open} onClose={onClose} title="Sesión personalizada" wide footer={<Button variant="primary" icon={<Shuffle size={17} />} onClick={() => onStart(query())}>Empezar</Button>}>
      <div className="space-y-5">
        <Field label="Partes del examen">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PART_LABELS) as ExamPart[]).filter((p) => p !== 'GEN').map((p) => (
              <button key={p} type="button" onClick={() => setParts(toggle(parts, p))} className={cx('rounded-full border px-3 py-1.5 text-sm', parts.includes(p) ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{PART_LABELS[p].short}</button>
            ))}
          </div>
        </Field>
        <Field label="Categorías">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCats(toggle(cats, c))} className={cx('rounded-full border px-3 py-1 text-xs', cats.includes(c) ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{CATEGORY_LABELS[c]}</button>
            ))}
          </div>
        </Field>
        <Field label={`Cantidad máxima: ${size}`}>
          <input type="range" min={5} max={100} step={5} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
        </Field>
        <div className="divide-y divide-line rounded-2xl border border-line px-4">
          <Toggle checked={scheduled} onChange={setScheduled} label="Respetar la programación FSRS" description="Activado: solo vencidas y nuevas de la selección (cuenta para FSRS). Desactivado: repaso libre que no altera la programación." />
          <Toggle checked={exam} onChange={setExam} label="Modo examen" description="Sin pistas ni etiquetas." />
        </div>
        <p className="text-xs text-muted">Sin filtros = todas las categorías.</p>
      </div>
    </Modal>
  );
}
