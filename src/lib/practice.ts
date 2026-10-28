// Estudio estilo Anki con las flashcards (tipo «flash»): aprendizaje vencido primero, después repasos y
// nuevas mezclados (con límite diario de nuevas) y, al final, lo que vence en los próximos 20 minutos.
import type { Card, CardState, Knowledge, Settings } from './types';
import type { Library, TodayStats } from './queue';
import { endOfStudyDay } from './util';

export const LEARN_AHEAD_MS = 20 * 60_000;

export function isFlashCard(card: Card, k: Knowledge | undefined): boolean {
  return card.type === 'flash' && !card.suspended && !card.deleted && !!k && k.status !== 'archived';
}

export type Tone = 'wf' | 'idiom' | 'phrasal' | 'pattern' | 'structure' | 'colloc' | 'fixed' | 'linker' | 'vocab';

const GRAMMAR = new Set(['grammar_pattern', 'inversion', 'conditional', 'cleft', 'emphasis', 'passive', 'causative', 'relative_clause', 'comparative', 'reporting', 'tense', 'agreement', 'possessive']);

/** Etiqueta y color de la tarjeta según la categoría principal del conocimiento. */
export function categoryOf(k: Knowledge): { label: string; tone: Tone } {
  const c = new Set<string>(k.categories);
  if (c.has('word_formation')) return { label: 'Word formation', tone: 'wf' };
  if (c.has('idiom')) return { label: 'Idiom', tone: 'idiom' };
  if (c.has('phrasal_verb')) return { label: 'Phrasal verb', tone: 'phrasal' };
  if (c.has('verb_pattern')) return { label: 'Pattern', tone: 'pattern' };
  if ([...c].some((x) => GRAMMAR.has(x))) return { label: 'Structure', tone: 'structure' };
  if (c.has('collocation')) return { label: 'Collocation', tone: 'colloc' };
  if (c.has('fixed_phrase') || c.has('prepositional_phrase') || c.has('expression')) return { label: 'Fixed phrase', tone: 'fixed' };
  if (c.has('linking')) return { label: 'Linker', tone: 'linker' };
  return { label: 'Vocabulary', tone: 'vocab' };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DeckSnapshot {
  counts: { new: number; learning: number; review: number };
  next: Card | null;
  /** Próximo vencimiento de una tarjeta en aprendizaje (si hoy no queda nada más). */
  nextLearningAt?: number;
  /** Nuevas que todavía no se vieron nunca (para «Learn more»). */
  unseen: number;
}

export interface DeckOptions {
  now?: Date;
  /** Nuevas extra pedidas hoy además del límite diario. */
  extraNew?: number;
  /** La tarjeta recién respondida no se repite enseguida si hay otra opción. */
  lastCardId?: string;
  rand?: () => number;
}

export function deckSnapshot(lib: Library, settings: Settings, today: TodayStats, opts: DeckOptions = {}): DeckSnapshot {
  const now = opts.now ?? new Date();
  const t = now.getTime();
  const rand = opts.rand ?? Math.random;
  const endOfDay = endOfStudyDay(now, settings.dayStartsAtHour).getTime();
  const learning: { card: Card; due: number }[] = [];
  const reviews: { card: Card; due: number; key: number }[] = [];
  const fresh: { card: Card; k: Knowledge; key: number }[] = [];

  for (const card of lib.cards) {
    const k = lib.knowledge.get(card.knowledgeId);
    if (!isFlashCard(card, k)) continue;
    const state: CardState | undefined = lib.states.get(card.id);
    if (!state || state.state === 0) {
      if (k!.status !== 'mastered') fresh.push({ card, k: k!, key: hash(card.id + today.day) });
      continue;
    }
    const due = new Date(state.due).getTime();
    if (state.state === 1 || state.state === 3) {
      if (due < endOfDay) learning.push({ card, due });
    } else if (due < endOfDay) {
      reviews.push({ card, due, key: hash(card.id + today.day) });
    }
  }

  // Nuevas: primero los errores recurrentes; el resto en un orden mezclado distinto cada día.
  fresh.sort((a, b) => b.k.priority - a.k.priority || b.k.timesMissed - a.k.timesMissed || a.key - b.key);
  // Repasos: primero los de días anteriores; dentro del mismo día, mezclados.
  reviews.sort((a, b) => Math.floor(a.due / 86_400_000) - Math.floor(b.due / 86_400_000) || a.key - b.key);
  const newQueue = fresh.slice(0, Math.max(0, settings.newPerDay - today.newDone) + (opts.extraNew ?? 0));
  const reviewQueue = reviews.slice(0, Math.max(0, settings.reviewsPerDay - today.reviewsDone));
  learning.sort((a, b) => a.due - b.due);

  const counts = { new: newQueue.length, learning: learning.length, review: reviewQueue.length };
  const skip = (c: Card) => c.id === opts.lastCardId;
  const pickFrom = <T extends { card: Card }>(list: T[]) => list.find((x) => !skip(x.card))?.card;

  let next: Card | null | undefined = pickFrom(learning.filter((l) => l.due <= t));
  if (!next) {
    const r = pickFrom(reviewQueue);
    const n = pickFrom(newQueue);
    if (r && n) next = rand() < newQueue.length / (newQueue.length + reviewQueue.length) ? n : r;
    else next = r ?? n;
  }
  next ??= pickFrom(learning.filter((l) => l.due <= t + LEARN_AHEAD_MS));
  // Si lo único que queda es la tarjeta recién respondida, se vuelve a mostrar (como Anki).
  next ??= learning.find((l) => l.due <= t + LEARN_AHEAD_MS)?.card ?? reviewQueue[0]?.card ?? newQueue[0]?.card ?? null;

  return { counts, next, nextLearningAt: learning[0]?.due, unseen: fresh.length };
}

/** Partes del frente separadas por el hueco y respuestas que van en cada uno. */
export function splitFront(card: Card): { parts: string[]; answers: string[] } {
  const parts = card.prompt.split('____');
  const answers = card.answer.split(/\s*…\s*/);
  return { parts, answers };
}

/** Separa una oración con marcas {{…}} en tramos normales y resaltados. */
export function markedSegments(text: string): { text: string; mark: boolean }[] {
  const out: { text: string; mark: boolean }[] = [];
  const re = /\{\{(.+?)\}\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mark: false });
    out.push({ text: m[1], mark: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: false });
  return out;
}
