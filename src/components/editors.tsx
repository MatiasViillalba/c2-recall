import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CARD_TYPE_LABELS, CATEGORY_LABELS, ERROR_TYPE_LABELS, PART_LABELS } from '../lib/labels';
import { CATEGORIES, EXAM_PARTS, type Card, type CardType, type Category, type ErrorType, type ExamPart, type Example, type Knowledge } from '../lib/types';
import { normalizeItem, slugify } from '../lib/content/normalize.ts';
import { addCards, createKnowledge, enqueue, updateCard, updateKnowledge } from '../lib/repo';
import { db } from '../lib/db';
import { nowIso, uuid } from '../lib/util';
import { Button, Chip, cx, Field, inputClass } from './ui';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function ChipPicker<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2')}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

export interface KnowledgeDraft {
  expression: string;
  meaningEs: string;
  promptEs: string;
  pattern: string;
  notes: string;
  categories: Category[];
  examParts: ExamPart[];
  examples: Example[];
  wrong: string;
  confusables: string;
  aliases: string;
  tags: string;
  errorType: ErrorType | '';
  validation: 'validated' | 'pending';
  source: string;
}

function toDraft(k?: Knowledge): KnowledgeDraft {
  return {
    expression: k?.expression ?? '',
    meaningEs: k?.meaningEs ?? '',
    promptEs: k?.promptEs ?? '',
    pattern: k?.pattern ?? '',
    notes: k?.notes ?? '',
    categories: k?.categories ?? ['expression'],
    examParts: k?.examParts ?? [],
    examples: k?.examples?.length ? k.examples : [{ en: '', es: '' }],
    wrong: (k?.wrongAnswers ?? []).join('\n'),
    confusables: (k?.confusables ?? []).join('\n'),
    aliases: (k?.aliases ?? []).join('\n'),
    tags: (k?.tags ?? []).join(', '),
    errorType: k?.errorType ?? '',
    validation: k?.validation ?? 'validated',
    source: '',
  };
}

export function KnowledgeEditor({ knowledge, onDone }: { knowledge?: Knowledge; onDone: (id: string) => void }) {
  const [d, setD] = useState<KnowledgeDraft>(() => toDraft(knowledge));
  const [extra, setExtra] = useState<{ type: CardType; q: string; a: string; o: string; kw: string; root: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof KnowledgeDraft>(key: K, v: KnowledgeDraft[K]) => setD((x) => ({ ...x, [key]: v }));

  async function save() {
    setError(null);
    if (!d.expression.trim() || !d.meaningEs.trim()) {
      setError('Completá al menos la expresión en inglés y su significado en español.');
      return;
    }
    setSaving(true);
    try {
      const examples = d.examples.filter((e) => e.en.trim());
      if (knowledge) {
        await updateKnowledge(knowledge.id, {
          expression: d.expression.trim(),
          meaningEs: d.meaningEs.trim(),
          promptEs: d.promptEs.trim() || undefined,
          pattern: d.pattern.trim() || undefined,
          notes: d.notes.trim() || undefined,
          categories: d.categories.length ? d.categories : ['expression'],
          examParts: d.examParts.length ? d.examParts : ['GEN'],
          examples,
          wrongAnswers: lines(d.wrong),
          confusables: lines(d.confusables),
          aliases: lines(d.aliases),
          tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
          errorType: d.errorType || undefined,
          validation: d.validation,
        });
        onDone(knowledge.id);
        return;
      }
      const now = nowIso();
      let id = slugify(d.expression);
      if (await db.knowledge.get(id)) id = `${id}-${uuid().slice(0, 4)}`;
      const sourceTitle = d.source.trim();
      const raw = {
        id, t: d.expression, es: d.meaningEs, qes: d.promptEs || undefined, pat: d.pattern || undefined, note: d.notes || undefined,
        cat: d.categories, parts: d.examParts, ex: examples.map((e) => [e.en, e.es ?? '']), wrong: lines(d.wrong), conf: lines(d.confusables),
        aka: lines(d.aliases), tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), err: d.errorType || undefined, val: d.validation,
        miss: lines(d.wrong).length ? 1 : 0,
        cards: extra && extra.q && extra.a ? [{ k: extra.type, q: extra.q, a: extra.a, o: extra.o || undefined, kw: extra.kw || undefined, root: extra.root || undefined }] : [],
      };
      const sourceId = sourceTitle ? `src-${slugify(sourceTitle)}` : undefined;
      const norm = normalizeItem(raw, { now, origin: 'manual', resolveSource: () => (sourceId ? [{ sourceId }] : []) });
      const blocking = norm.issues.filter((i) => i.level === 'error');
      if (blocking.length) throw new Error(blocking.map((i) => i.message).join(' '));
      if (sourceId && !(await db.sources.get(sourceId))) {
        await db.sources.put({ id: sourceId, title: sourceTitle, kind: 'other', createdAt: now, updatedAt: now });
        await enqueue('sources', [sourceId]);
      }
      norm.knowledge.sources = sourceId ? [{ sourceId }] : [];
      await createKnowledge(norm.knowledge, norm.cards);
      onDone(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expresión en inglés *"><input className={inputClass} value={d.expression} onChange={(e) => set('expression', e.target.value)} placeholder="work like magic" /></Field>
        <Field label="Significado en español *"><input className={inputClass} value={d.meaningEs} onChange={(e) => set('meaningEs', e.target.value)} placeholder="funcionar de maravilla" /></Field>
      </div>
      <Field label="Pregunta en español para «¿Cómo se dice…?»" hint="Opcional. Si la dejás vacía se usa el significado.">
        <input className={inputClass} value={d.promptEs} onChange={(e) => set('promptEs', e.target.value)} placeholder="funcionó de maravilla" />
      </Field>
      <Field label="Categorías"><ChipPicker options={CATEGORIES} value={d.categories} onChange={(v) => set('categories', v)} label={(c) => CATEGORY_LABELS[c]} /></Field>
      <Field label="Parte del examen"><ChipPicker options={EXAM_PARTS} value={d.examParts} onChange={(v) => set('examParts', v)} label={(p) => PART_LABELS[p].short} /></Field>
      <Field label="Estructura / patrón"><input className={inputClass} value={d.pattern} onChange={(e) => set('pattern', e.target.value)} placeholder="SUBJECT + WORK LIKE MAGIC" /></Field>

      <div>
        <div className="mb-1.5 text-sm font-medium text-ink-2">Ejemplos</div>
        <p className="mb-2 text-xs text-muted">Marcá con {'{{ }}'} la parte que querés practicar como hueco: «The new approach {'{{worked like magic}}'}.»</p>
        <div className="space-y-2">
          {d.examples.map((ex, i) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-surface-2 p-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={inputClass} value={ex.en} placeholder="Ejemplo en inglés" onChange={(e) => set('examples', d.examples.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
              <input className={inputClass} value={ex.es ?? ''} placeholder="Traducción" onChange={(e) => set('examples', d.examples.map((x, j) => (j === i ? { ...x, es: e.target.value } : x)))} />
              <Button variant="ghost" onClick={() => set('examples', d.examples.filter((_, j) => j !== i))} aria-label="Quitar ejemplo"><Trash2 size={16} /></Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => set('examples', [...d.examples, { en: '', es: '' }])}>Agregar ejemplo</Button>
        </div>
      </div>

      <Field label="Regla / explicación"><textarea className={cx(inputClass, 'min-h-[84px]')} value={d.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Respuestas incorrectas que diste (una por línea)"><textarea className={cx(inputClass, 'min-h-[72px]')} value={d.wrong} onChange={(e) => set('wrong', e.target.value)} placeholder="had magic effects" /></Field>
        <Field label="Confusiones / diferencias (una por línea)"><textarea className={cx(inputClass, 'min-h-[72px]')} value={d.confusables} onChange={(e) => set('confusables', e.target.value)} placeholder="work wonders" /></Field>
        <Field label="Variantes (una por línea)"><textarea className={cx(inputClass, 'min-h-[60px]')} value={d.aliases} onChange={(e) => set('aliases', e.target.value)} /></Field>
        <Field label="Etiquetas (separadas por coma)"><input className={inputClass} value={d.tags} onChange={(e) => set('tags', e.target.value)} placeholder="mock-3, listening" /></Field>
        <Field label="Tipo de error">
          <select className={inputClass} value={d.errorType} onChange={(e) => set('errorType', e.target.value as ErrorType | '')}>
            <option value="">— no es un error —</option>
            {(Object.keys(ERROR_TYPE_LABELS) as ErrorType[]).map((t) => <option key={t} value={t}>{ERROR_TYPE_LABELS[t].label}</option>)}
          </select>
        </Field>
        <Field label="Validación">
          <select className={inputClass} value={d.validation} onChange={(e) => set('validation', e.target.value as 'validated' | 'pending')}>
            <option value="validated">Validado</option>
            <option value="pending">Pendiente de validación</option>
          </select>
        </Field>
        {!knowledge && <Field label="Fuente (opcional)"><input className={inputClass} value={d.source} onChange={(e) => set('source', e.target.value)} placeholder="Mock Exam 3 · Part 4" /></Field>}
      </div>

      {!knowledge && (
        <div className="rounded-2xl border border-line p-4">
          <p className="text-sm text-ink-2">Se crean automáticamente las tarjetas «¿Cómo se dice…?» y «Completá» (si un ejemplo tiene {'{{ }}'}). Podés sumar una tarjeta especial:</p>
          {!extra ? (
            <Button size="sm" variant="soft" className="mt-3" icon={<Plus size={15} />} onClick={() => setExtra({ type: 'kwt', q: '', a: '', o: '', kw: '', root: '' })}>Agregar tarjeta especial</Button>
          ) : (
            <ExtraCardFields value={extra} onChange={setExtra} />
          )}
        </div>
      )}

      {error && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>{knowledge ? 'Guardar cambios' : 'Crear conocimiento'}</Button>
      </div>
    </div>
  );
}

function ExtraCardFields({ value, onChange }: { value: { type: CardType; q: string; a: string; o: string; kw: string; root: string }; onChange: (v: typeof value | null) => void }) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(['kwt', 'wf', 'contrast', 'pattern', 'prod', 'fix', 'cloze'] as CardType[]).map((t) => (
          <button key={t} type="button" onClick={() => set({ type: t })} className={cx('rounded-full border px-3 py-1 text-xs font-medium', value.type === t ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{CARD_TYPE_LABELS[t].label}</button>
        ))}
      </div>
      {value.type === 'kwt' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Oración original"><input className={inputClass} value={value.o} onChange={(e) => set({ o: e.target.value })} placeholder="She persuaded me not to resign." /></Field>
          <Field label="Keyword"><input className={inputClass} value={value.kw} onChange={(e) => set({ kw: e.target.value.toUpperCase() })} placeholder="OUT" /></Field>
        </div>
      )}
      {value.type === 'wf' && <Field label="Raíz"><input className={inputClass} value={value.root} onChange={(e) => set({ root: e.target.value.toUpperCase() })} placeholder="EDUCATE" /></Field>}
      <Field label={value.type === 'prod' ? 'Oración en español' : value.type === 'fix' ? 'Oración con el error' : 'Pregunta (usá ____ para el hueco)'}>
        <input className={inputClass} value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder={value.type === 'kwt' ? 'She ____ resigning.' : ''} />
      </Field>
      <Field label="Respuesta"><input className={inputClass} value={value.a} onChange={(e) => set({ a: e.target.value })} placeholder={value.type === 'kwt' ? 'talked me out of' : ''} /></Field>
      <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Quitar tarjeta especial</Button>
    </div>
  );
}

export function CardEditor({ card, knowledgeId, onDone }: { card?: Card; knowledgeId: string; onDone: () => void }) {
  const [type, setType] = useState<CardType>(card?.type ?? 'es2en');
  const [f, setF] = useState({
    prompt: card?.prompt ?? '', answer: card?.answer ?? '', alternatives: (card?.alternatives ?? []).join('\n'), explanation: card?.explanation ?? '',
    hint: card?.hint ?? '', original: card?.original ?? '', keyword: card?.keyword ?? '', root: card?.root ?? '', pos: card?.pos ?? '', translation: card?.translation ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  async function save() {
    if (!f.prompt.trim() || !f.answer.trim()) return setError('La tarjeta necesita pregunta y respuesta.');
    if ((type === 'cloze' || type === 'kwt' || type === 'wf') && !f.prompt.includes('____')) return setError('Usá «____» para marcar el hueco.');
    const patch: Partial<Card> = {
      prompt: f.prompt.trim(), answer: f.answer.trim(), alternatives: lines(f.alternatives), explanation: f.explanation.trim() || undefined,
      hint: f.hint.trim() || undefined, original: f.original.trim() || undefined, keyword: f.keyword.trim().toUpperCase() || undefined,
      root: f.root.trim().toUpperCase() || undefined, pos: f.pos.trim() || undefined, translation: f.translation.trim() || undefined,
    };
    if (card) await updateCard(card.id, patch);
    else {
      const now = nowIso();
      await addCards(knowledgeId, [{ id: `${knowledgeId}:${type}:m-${uuid().slice(0, 8)}`, knowledgeId, type, origin: 'manual', createdAt: now, updatedAt: now, alternatives: [], ...patch } as Card]);
    }
    onDone();
  }

  return (
    <div className="space-y-3">
      {!card && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cx('rounded-full border px-3 py-1 text-xs font-medium', type === t ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{CARD_TYPE_LABELS[t].label}</button>
          ))}
        </div>
      )}
      {card && <Chip tone={CARD_TYPE_LABELS[type].tone}>{CARD_TYPE_LABELS[type].label}</Chip>}
      {type === 'kwt' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Oración original"><input className={inputClass} value={f.original} onChange={(e) => set({ original: e.target.value })} /></Field>
          <Field label="Keyword"><input className={inputClass} value={f.keyword} onChange={(e) => set({ keyword: e.target.value })} /></Field>
        </div>
      )}
      {type === 'wf' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raíz"><input className={inputClass} value={f.root} onChange={(e) => set({ root: e.target.value })} /></Field>
          <Field label="Categoría gramatical"><input className={inputClass} value={f.pos} onChange={(e) => set({ pos: e.target.value })} placeholder="adj." /></Field>
        </div>
      )}
      <Field label="Pregunta (frente)"><textarea className={cx(inputClass, 'min-h-[72px]')} value={f.prompt} onChange={(e) => set({ prompt: e.target.value })} /></Field>
      <Field label="Respuesta"><input className={inputClass} value={f.answer} onChange={(e) => set({ answer: e.target.value })} /></Field>
      <Field label="Alternativas aceptables (una por línea)"><textarea className={cx(inputClass, 'min-h-[60px]')} value={f.alternatives} onChange={(e) => set({ alternatives: e.target.value })} /></Field>
      <Field label="Pista (opcional)"><input className={inputClass} value={f.hint} onChange={(e) => set({ hint: e.target.value })} /></Field>
      <Field label="Explicación (opcional)"><textarea className={cx(inputClass, 'min-h-[60px]')} value={f.explanation} onChange={(e) => set({ explanation: e.target.value })} /></Field>
      {type === 'cloze' && <Field label="Traducción de la oración"><input className={inputClass} value={f.translation} onChange={(e) => set({ translation: e.target.value })} /></Field>}
      {error && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>}
      <p className="text-xs text-muted">Editar el texto no modifica el historial de repasos ni la programación de la tarjeta.</p>
      <div className="flex justify-end"><Button variant="primary" onClick={() => void save()}>{card ? 'Guardar tarjeta' : 'Agregar tarjeta'}</Button></div>
    </div>
  );
}
