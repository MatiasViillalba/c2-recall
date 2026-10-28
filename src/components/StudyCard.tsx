import { useMemo, type ReactNode } from 'react';
import { BookMarked, ChevronDown, CircleAlert, GitCompareArrows, Lightbulb, ScrollText, Shapes, Volume2 } from 'lucide-react';
import type { Card, Knowledge, Source } from '../lib/types';
import { CARD_TYPE_LABELS, CATEGORY_LABELS, ERROR_TYPE_LABELS, PART_LABELS } from '../lib/labels';
import { BLANK, stripCloze } from '../lib/content/normalize.ts';
import { Chip, cx, IconButton } from './ui';

/** Divide un texto con «____» en fragmentos para resaltar el hueco o la respuesta. */
function renderWithBlank(text: string, fill?: string): ReactNode[] {
  const parts = text.split(BLANK);
  const fills = fill ? fill.split(/\s*…\s*/) : [];
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    out.push(<span key={`t${i}`}>{p}</span>);
    if (i < parts.length - 1) {
      out.push(fill
        ? <mark key={`f${i}`} className="rounded-md bg-sage-soft px-1 font-semibold text-sage">{fills[i] ?? fills[fills.length - 1]}</mark>
        : <span key={`b${i}`} className="blank" aria-label="hueco">&nbsp;</span>);
    }
  });
  return out;
}

/** Ejemplo con la parte {{marcada}} resaltada. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{\{.+?\}\})/g);
  return (
    <>
      {parts.map((p, i) => p.startsWith('{{')
        ? <strong key={i} className="font-semibold text-primary">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>)}
    </>
  );
}

export interface StudyCardProps {
  card: Card;
  knowledge: Knowledge;
  revealed: boolean;
  examMode?: boolean;
  quick?: boolean;
  showHint?: boolean;
  onSpeak: (text: string) => void;
  sources: Map<string, Source>;
  typed?: string;
}

export function CardFront({ card, knowledge, showHint, examMode, compact }: Pick<StudyCardProps, 'card' | 'knowledge' | 'showHint' | 'examMode'> & { compact?: boolean }) {
  const meta = CARD_TYPE_LABELS[card.type];
  const hint = !examMode && showHint ? card.hint ?? knowledge.hint : undefined;
  // Al revelar, el frente se compacta para que la respuesta quede a la vista (sobre todo en el iPhone).
  const big = compact ? 'text-lg leading-relaxed' : 'text-[1.3rem] leading-relaxed sm:text-[1.7rem]';
  const quote = compact ? 'text-xl leading-snug' : 'text-[1.6rem] leading-snug sm:text-[2rem]';
  return (
    <div className={cx('flex flex-col', compact ? 'gap-2.5' : 'gap-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={meta.tone}>{meta.label}</Chip>
        {!examMode && knowledge.examParts.filter((p) => p !== 'GEN').slice(0, 2).map((p) => <Chip key={p}>{PART_LABELS[p].short}</Chip>)}
        {!examMode && knowledge.priority >= 3 && <Chip tone="coral">error recurrente</Chip>}
      </div>
      {!compact && <p className="text-sm font-medium text-muted">{meta.instruction}</p>}

      {card.type === 'es2en' && (
        <p className={cx('font-display text-ink', quote)}>«{card.prompt}»</p>
      )}
      {(card.type === 'cloze' || card.type === 'fix') && (
        <p className={cx('font-display text-ink', big)}>{renderWithBlank(card.prompt)}</p>
      )}
      {card.type === 'prod' && (
        <p className={cx('font-display text-ink', quote)}>«{card.prompt}»</p>
      )}
      {(card.type === 'contrast' || card.type === 'pattern') && (
        <p className={cx('font-medium leading-snug text-ink', compact ? 'text-base' : 'text-[1.2rem] sm:text-[1.45rem]')}>{card.prompt}</p>
      )}
      {card.type === 'kwt' && (
        <div className={compact ? 'space-y-2' : 'space-y-4'}>
          <div className={cx('rounded-2xl bg-surface-2', compact ? 'px-3 py-2' : 'px-4 py-3')}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Original</div>
            <p className={cx('font-display leading-relaxed text-ink-2', compact ? 'text-[15px]' : 'text-[1.05rem] sm:text-lg')}>{card.original}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Keyword</span>
            <span className="rounded-xl bg-primary px-3 py-1 font-mono text-base font-semibold tracking-wider text-primary-ink">{card.keyword}</span>
          </div>
          <p className={cx('font-display text-ink', big)}>{renderWithBlank(card.prompt)}</p>
        </div>
      )}
      {card.type === 'wf' && (
        <div className={compact ? 'space-y-2' : 'space-y-4'}>
          <p className={cx('font-display text-ink', big)}>{renderWithBlank(card.prompt)}</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Raíz</span>
            <span className="rounded-xl bg-sage-soft px-3 py-1 font-mono text-base font-semibold tracking-wider text-sage">{card.root}</span>
          </div>
        </div>
      )}
      {hint && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-soft px-3.5 py-2.5 text-sm text-ink-2 anim-fade">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

export function CardBack({ card, knowledge, onSpeak, sources, quick, typed }: StudyCardProps) {
  const fullSentence = useMemo(() => {
    if (card.type === 'cloze' || card.type === 'kwt' || card.type === 'wf') return renderWithBlank(card.prompt, card.answer);
    return null;
  }, [card]);
  const speakText = card.type === 'cloze' || card.type === 'kwt' || card.type === 'wf'
    ? card.prompt.split(BLANK).reduce((acc, part, i, arr) => acc + part + (i < arr.length - 1 ? (card.answer.split(/\s*…\s*/)[i] ?? card.answer) : ''), '')
    : card.answer;
  const typedCheck = typed?.trim() ? checkTyped(typed, card) : null;
  const examples = knowledge.examples.slice(0, quick ? 1 : 3);

  return (
    <div className="flex flex-col gap-4 anim-flip">
      {typedCheck && (
        <div className={cx('rounded-2xl px-3.5 py-2.5 text-sm', typedCheck.ok ? 'bg-sage-soft text-sage' : 'bg-coral-soft text-coral')}>
          {typedCheck.ok ? '✓ Tu respuesta coincide' : <>Escribiste: <span className="font-semibold line-through decoration-2">{typed}</span></>}
        </div>
      )}
      <div className="rounded-3xl border border-sage/25 bg-sage-soft/60 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sage">Respuesta</div>
            <p className="mt-1 font-display text-[1.6rem] font-semibold leading-snug text-ink sm:text-[1.9rem]">{card.answer}</p>
            {card.alternatives.length > 0 && (
              <p className="mt-1 text-sm text-ink-2">También: {card.alternatives.join(' · ')}</p>
            )}
          </div>
          <IconButton label="Escuchar pronunciación" onClick={() => onSpeak(speakText)} className="shrink-0 bg-surface text-primary shadow-soft"><Volume2 size={20} /></IconButton>
        </div>
        {fullSentence && <p className="mt-3 border-t border-sage/20 pt-3 font-display text-lg leading-relaxed text-ink-2">{fullSentence}</p>}
        {card.translation && card.type !== 'es2en' && <p className="mt-1 text-sm text-muted">{card.translation}</p>}
        {card.type === 'kwt' && card.original && <p className="mt-2 text-xs text-muted">Original: {card.original}</p>}
      </div>

      <div className="px-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {card.type !== 'es2en' && <span className="font-display text-xl text-ink">{knowledge.expression}</span>}
          <span className="text-[15px] text-ink-2">{card.type !== 'es2en' ? '— ' : ''}{knowledge.meaningEs}</span>
        </div>
        {card.explanation && card.type !== 'cloze' && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{card.explanation}</p>}
      </div>

      {examples.length > 0 && (
        <ul className="space-y-2.5">
          {examples.map((ex, i) => (
            <li key={i} className="flex gap-2 rounded-2xl bg-surface-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.05rem] leading-relaxed text-ink"><Highlighted text={ex.en} /></p>
                {ex.es && <p className="mt-0.5 text-sm text-muted">{ex.es}</p>}
              </div>
              <IconButton label="Escuchar ejemplo" onClick={() => onSpeak(stripCloze(ex.en))} className="h-8 w-8 shrink-0"><Volume2 size={16} /></IconButton>
            </li>
          ))}
        </ul>
      )}

      {!quick && <KnowledgeDetails knowledge={knowledge} sources={sources} />}
    </div>
  );
}

export function KnowledgeDetails({ knowledge: k, sources, defaultOpen }: { knowledge: Knowledge; sources: Map<string, Source>; defaultOpen?: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {(k.pattern || k.notes) && (
        <Section icon={<ScrollText size={16} />} title="Regla y patrón" open={defaultOpen ?? true}>
          {k.pattern && <p className="mb-2 rounded-xl bg-primary-soft px-3 py-2 font-mono text-[13px] leading-relaxed text-primary">{k.pattern}</p>}
          {k.notes && <p className="text-[15px] leading-relaxed text-ink-2">{k.notes}</p>}
        </Section>
      )}
      {k.wrongAnswers.length > 0 && (
        <Section icon={<CircleAlert size={16} />} title="Errores típicos (lo que escribiste)" open={defaultOpen}>
          <ul className="space-y-1">
            {k.wrongAnswers.map((w, i) => <li key={i} className="text-[15px] text-coral"><span className="mr-1">✗</span>{w}</li>)}
          </ul>
          {k.errorType && <p className="mt-2 text-xs text-muted"><Chip tone={ERROR_TYPE_LABELS[k.errorType].tone}>{ERROR_TYPE_LABELS[k.errorType].label}</Chip> {ERROR_TYPE_LABELS[k.errorType].description}</p>}
        </Section>
      )}
      {(k.confusables.length > 0 || k.aliases.length > 0) && (
        <Section icon={<GitCompareArrows size={16} />} title="Diferencias y variantes" open={defaultOpen}>
          {k.confusables.length > 0 && <ul className="space-y-1 text-[15px] text-ink-2">{k.confusables.map((c, i) => <li key={i}>≠ {c}</li>)}</ul>}
          {k.aliases.length > 0 && <p className="mt-2 text-sm text-muted">Variantes: {k.aliases.join(' · ')}</p>}
        </Section>
      )}
      {k.family.length > 0 && (
        <Section icon={<Shapes size={16} />} title="Familia de palabras" open={defaultOpen}>
          <table className="w-full text-sm">
            <tbody>
              {k.family.map((f, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3 font-semibold text-ink">{f.word}</td>
                  <td className="py-1.5 pr-3 text-muted">{f.pos}</td>
                  <td className="py-1.5 text-ink-2">{f.gloss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section icon={<BookMarked size={16} />} title="Fuente, categoría y etiquetas" open={defaultOpen}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {k.categories.map((c) => <Chip key={c} tone="lavender">{CATEGORY_LABELS[c]}</Chip>)}
          {k.examParts.map((p) => <Chip key={p}>{PART_LABELS[p].long}</Chip>)}
          {k.validation === 'pending' && <Chip tone="amber">pendiente de validación</Chip>}
          {k.tags.map((t) => <Chip key={t}>#{t}</Chip>)}
        </div>
        <ul className="space-y-0.5 text-sm text-muted">
          {k.sources.filter((s) => s.sourceId !== 'capturas').slice(0, 6).map((s, i) => (
            <li key={i}>
              {sources.get(s.sourceId)?.title.replace(/\.pdf$/, '') ?? s.sourceId}{s.page ? `, p. ${s.page}` : ''}{s.exercise ? ` — ${s.exercise}` : ''}
            </li>
          ))}
          {k.sources.filter((s) => s.sourceId !== 'capturas').length > 6 && <li>… y {k.sources.length - 6} referencias más</li>}
        </ul>
      </Section>
    </div>
  );
}

function Section({ icon, title, children, open }: { icon: ReactNode; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group bg-surface">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-2 transition hover:bg-surface-2">
        <span className="text-lavender">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown size={16} className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function normalizeAnswer(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkTyped(typed: string, card: Card): { ok: boolean } {
  const t = normalizeAnswer(typed);
  const candidates = [card.answer, ...card.alternatives].flatMap((a) => a.split(/\s*\/\s*/)).map(normalizeAnswer);
  return { ok: candidates.some((c) => c === t || c.replace(/^(the|a|an) /, '') === t) };
}
