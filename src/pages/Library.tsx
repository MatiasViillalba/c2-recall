import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Filter, Flag, Plus, Search, Star } from 'lucide-react';
import { db } from '../lib/db';
import { CATEGORY_LABELS, ERROR_TYPE_LABELS, PART_LABELS } from '../lib/labels';
import { CATEGORIES, EXAM_PARTS, type CardState, type Category, type ExamPart, type Knowledge } from '../lib/types';
import { normalizeExpression, stripCloze } from '../lib/content/normalize.ts';
import { Button, Chip, cx, EmptyState, inputClass, PageHeader, Panel } from '../components/ui';
import { relativeDue } from '../lib/util';
import { difficultyLabel } from '../lib/scheduler';

type Sort = 'recent' | 'errors' | 'due' | 'alpha' | 'difficulty';
type Status = 'active' | 'archived' | 'mastered' | 'all';

interface Row {
  k: Knowledge;
  cards: number;
  suspended: number;
  flagged: number;
  nextDue?: string;
  lapses: number;
  worst?: CardState;
  studied: boolean;
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = useDeferredValue(query);
  const [part, setPart] = useState<ExamPart | ''>((params.get('part') as ExamPart) ?? '');
  const [cat, setCat] = useState<Category | ''>((params.get('cat') as Category) ?? '');
  const [source, setSource] = useState(params.get('source') ?? '');
  const [status, setStatus] = useState<Status>('active');
  const [level, setLevel] = useState<'' | 'Nueva' | 'Fácil' | 'Media' | 'Difícil'>('');
  const [flags, setFlags] = useState({ errors: params.get('errors') === '1', favorites: false, pending: false, flagged: params.get('flagged') === '1' });
  const [sort, setSort] = useState<Sort>('recent');
  const [limit, setLimit] = useState(60);
  const [showFilters, setShowFilters] = useState(false);

  const data = useLiveQuery(async () => {
    const [knowledge, cards, states, sources] = await Promise.all([db.knowledge.toArray(), db.cards.toArray(), db.cardStates.toArray(), db.sources.toArray()]);
    const stateMap = new Map(states.map((s) => [s.cardId, s]));
    const rows = new Map<string, Row>();
    for (const k of knowledge) if (!k.deleted) rows.set(k.id, { k, cards: 0, suspended: 0, flagged: 0, lapses: 0, studied: false });
    for (const c of cards) {
      if (c.deleted) continue;
      const r = rows.get(c.knowledgeId);
      if (!r) continue;
      r.cards++;
      if (c.suspended) r.suspended++;
      if (c.flagged) r.flagged++;
      const s = stateMap.get(c.id);
      if (s && s.state !== 0) {
        r.studied = true;
        r.lapses += s.lapses;
        if (!c.suspended && (!r.nextDue || s.due < r.nextDue)) r.nextDue = s.due;
        if (!r.worst || s.difficulty > r.worst.difficulty) r.worst = s;
      }
    }
    return { rows: [...rows.values()], sources };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = normalizeExpression(q);
    const plain = q.trim().toLowerCase();
    let rows = data.rows.filter(({ k, flagged, worst }) => {
      if (status !== 'all' && k.status !== status) return false;
      if (part && !k.examParts.includes(part)) return false;
      if (cat && !k.categories.includes(cat)) return false;
      if (source && !k.sources.some((s) => s.sourceId === source)) return false;
      if (flags.errors && !(k.timesMissed > 0 || k.errorType === 'error')) return false;
      if (flags.favorites && !k.favorite) return false;
      if (flags.pending && k.validation !== 'pending') return false;
      if (flags.flagged && !flagged) return false;
      if (level && difficultyLabel(worst) !== level) return false;
      if (plain) {
        const hay = `${k.expression} ${k.aliases.join(' ')} ${k.meaningEs} ${k.pattern ?? ''} ${k.examples.map((e) => stripCloze(e.en)).join(' ')} ${k.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(plain) && !(needle && normalizeExpression(hay).includes(needle))) return false;
      }
      return true;
    });
    rows = rows.sort((a, b) => {
      switch (sort) {
        case 'errors': return b.k.timesMissed - a.k.timesMissed || b.lapses - a.lapses;
        case 'due': return (a.nextDue ?? '9999') < (b.nextDue ?? '9999') ? -1 : 1;
        case 'alpha': return a.k.expression.localeCompare(b.k.expression);
        case 'difficulty': return (b.worst?.difficulty ?? 0) - (a.worst?.difficulty ?? 0) || b.lapses - a.lapses;
        default: return b.k.createdAt.localeCompare(a.k.createdAt) || b.k.priority - a.k.priority;
      }
    });
    return rows;
  }, [data, q, part, cat, source, status, flags, level, sort]);

  const activeFilters = [part, cat, source, level].filter(Boolean).length + Object.values(flags).filter(Boolean).length + (status !== 'active' ? 1 : 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader
        eyebrow="Biblioteca"
        title="Tus conocimientos"
        subtitle={data ? `${data.rows.filter((r) => !r.k.deleted && r.k.status !== 'archived').length} conocimientos · ${data.rows.reduce((n, r) => n + r.cards, 0)} tarjetas` : 'Cargando…'}
        actions={<Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate('/add?tab=manual')}>Agregar</Button>}
      />

      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className={cx(inputClass, 'pl-10')}
              placeholder="Buscar expresión, significado, estructura o ejemplo…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(60); setParams((p) => { if (e.target.value) p.set('q', e.target.value); else p.delete('q'); return p; }, { replace: true }); }}
              type="search"
              enterKeyHint="search"
            />
          </div>
          <Button variant={activeFilters ? 'soft' : 'secondary'} onClick={() => setShowFilters((x) => !x)} icon={<Filter size={17} />}>
            <span className="hidden sm:inline">Filtros</span>{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        </div>
        {showFilters && (
          <Panel className="mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 anim-rise">
            <select className={inputClass} value={part} onChange={(e) => setPart(e.target.value as ExamPart | '')} aria-label="Parte del examen">
              <option value="">Todas las partes</option>
              {EXAM_PARTS.map((p) => <option key={p} value={p}>{PART_LABELS[p].long}</option>)}
            </select>
            <select className={inputClass} value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Fuente">
              <option value="">Todas las fuentes</option>
              {data?.sources.map((s) => <option key={s.id} value={s.id}>{s.title.replace(/\.pdf$/, '')}</option>)}
            </select>
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value as typeof level)} aria-label="Dificultad">
              <option value="">Cualquier dificultad</option>
              <option value="Nueva">Nuevas (sin estudiar)</option>
              <option value="Fácil">Fáciles</option>
              <option value="Media">Medias</option>
              <option value="Difícil">Difíciles</option>
            </select>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Estado">
              <option value="active">Activos</option>
              <option value="mastered">Dominados</option>
              <option value="archived">Archivados</option>
              <option value="all">Todos</option>
            </select>
            <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="recent">Más recientes</option>
              <option value="errors">Más errores</option>
              <option value="due">Próxima revisión</option>
              <option value="difficulty">Más difíciles</option>
              <option value="alpha">Alfabético</option>
            </select>
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
              {([['errors', 'Solo errores'], ['favorites', 'Favoritas'], ['pending', 'Pendientes de validación'], ['flagged', 'Reportadas']] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFlags((f) => ({ ...f, [key]: !f[key] }))} className={cx('rounded-full border px-3 py-1.5 text-sm', flags[key] ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{label}</button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {data && filtered.length === 0 ? (
        <EmptyState icon={<BookOpen size={26} />} title="No hay resultados" action={<Button onClick={() => { setQuery(''); setPart(''); setCat(''); setSource(''); setLevel(''); setFlags({ errors: false, favorites: false, pending: false, flagged: false }); setStatus('active'); }}>Limpiar filtros</Button>}>
          Probá con otra búsqueda o quitá filtros.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {filtered.slice(0, limit).map((r) => <LibraryRow key={r.k.id} row={r} />)}
        </ul>
      )}
      {filtered.length > limit && (
        <div className="mt-4 flex justify-center"><Button onClick={() => setLimit((l) => l + 80)}>Mostrar más ({filtered.length - limit})</Button></div>
      )}
      <div className="h-6" />
    </div>
  );
}

function LibraryRow({ row: { k, cards, nextDue, lapses, flagged, worst, suspended } }: { row: Row }) {
  const diff = difficultyLabel(worst);
  return (
    <li>
      <Link to={`/library/${encodeURIComponent(k.id)}`} className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-soft transition hover:border-line-strong hover:shadow-lifted">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[1.08rem] text-ink">{k.expression}</span>
            {k.favorite && <Star size={14} className="shrink-0 fill-amber text-amber" />}
            {flagged > 0 && <Flag size={14} className="shrink-0 text-coral" />}
          </div>
          <p className="truncate text-sm text-muted">{k.meaningEs}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {k.examParts.filter((p) => p !== 'GEN').slice(0, 2).map((p) => <Chip key={p}>{PART_LABELS[p].short}</Chip>)}
            <Chip tone="lavender">{CATEGORY_LABELS[k.categories[0]]}</Chip>
            {k.errorType && <Chip tone={ERROR_TYPE_LABELS[k.errorType].tone}>{k.timesMissed > 1 ? `${k.timesMissed}× ` : ''}{ERROR_TYPE_LABELS[k.errorType].label.toLowerCase()}</Chip>}
            {k.status !== 'active' && <Chip tone="sage">{k.status === 'mastered' ? 'dominado' : 'archivado'}</Chip>}
            {suspended > 0 && <Chip>{suspended} suspendida(s)</Chip>}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className={cx('font-medium', diff === 'Difícil' ? 'text-coral' : diff === 'Media' ? 'text-amber' : diff === 'Fácil' ? 'text-sage' : 'text-muted')}>{diff}</div>
          <div className="mt-0.5 text-muted">{nextDue ? relativeDue(nextDue) : `${cards} tarjeta${cards === 1 ? '' : 's'}`}</div>
          {lapses > 0 && <div className="text-faint">{lapses} fallos</div>}
        </div>
      </Link>
    </li>
  );
}
