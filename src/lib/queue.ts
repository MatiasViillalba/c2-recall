// Construcción de la cola de estudio: vencidas + aprendizaje + nuevas (con límites diarios),
// una sola tarjeta por conocimiento por día (hermanas enterradas) y prioridad a errores recurrentes.
import { db } from './db';
import type { Card, CardState, DeckFilter, Knowledge, ReviewEvent, Settings } from './types';
import { endOfStudyDay, shuffle, studyDay } from './util';

export type SessionMode = 'scheduled' | 'errors' | 'difficult' | 'custom' | 'favorites';

export interface QueueItem {
  cardId: string;
  knowledgeId: string;
  kind: 'new' | 'learning' | 'review' | 'cram';
}

export interface Library {
  knowledge: Map<string, Knowledge>;
  cards: Card[];
  states: Map<string, CardState>;
}

export async function loadLibrary(): Promise<Library> {
  const [knowledge, cards, states] = await Promise.all([db.knowledge.toArray(), db.cards.toArray(), db.cardStates.toArray()]);
  return {
    knowledge: new Map(knowledge.filter((k) => !k.deleted).map((k) => [k.id, k])),
    cards: cards.filter((c) => !c.deleted),
    states: new Map(states.map((s) => [s.cardId, s])),
  };
}

export function matchesFilter(k: Knowledge, card: Card | undefined, filter: DeckFilter | undefined, state?: CardState, leechThreshold = 4): boolean {
  if (!filter) return true;
  if (filter.knowledgeIds?.length && !filter.knowledgeIds.includes(k.id)) return false;
  if (filter.sourceIds?.length && !k.sources.some((s) => filter.sourceIds!.includes(s.sourceId))) return false;
  if (card && filter.cardTypes?.length && !filter.cardTypes.includes(card.type)) return false;
  if (filter.errorsOnly && !isErrorKnowledge(k)) return false;
  if (filter.favoritesOnly && !k.favorite) return false;
  if (filter.difficultOnly && !isDifficult(k, state, leechThreshold)) return false;
  const checks: boolean[] = [];
  if (filter.parts?.length) checks.push(k.examParts.some((p) => filter.parts!.includes(p)));
  if (filter.categories?.length) checks.push(k.categories.some((c) => filter.categories!.includes(c)));
  if (filter.tags?.length) checks.push(k.tags.some((t) => filter.tags!.includes(t)));
  if (!checks.length) return true;
  return filter.match === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

export function isErrorKnowledge(k: Knowledge): boolean {
  return k.timesMissed > 0 || k.errorType === 'error' || k.priority >= 3 || !!k.markedDifficult;
}

export function isDifficult(k: Knowledge, state: CardState | undefined, leechThreshold = 4): boolean {
  if (k.markedDifficult) return true;
  if (!state) return false;
  return state.lapses >= Math.max(2, Math.floor(leechThreshold / 2)) || (state.state !== 0 && state.difficulty >= 7.5);
}

export function isLeech(state: CardState | undefined, leechThreshold = 4): boolean {
  return !!state && state.lapses >= leechThreshold;
}

/** Orden preferido para la primera tarjeta de un conocimiento. */
const TYPE_ORDER: Record<string, number> = { kwt: 0, es2en: 1, cloze: 2, wf: 3, contrast: 4, pattern: 5, prod: 6, fix: 7 };

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface TodayStats {
  day: string;
  newDone: number;
  reviewsDone: number;
  totalDone: number;
  timeMs: number;
  knowledgeStudied: Set<string>;
  again: number;
}

export async function todayStats(settings: Settings, now = new Date()): Promise<TodayStats> {
  const day = studyDay(now, settings.dayStartsAtHour);
  const since = new Date(now.getTime() - 36 * 3600_000).toISOString();
  const events = (await db.reviews.where('reviewedAt').above(since).toArray()).filter(
    (e) => !e.deleted && e.kind !== 'reset' && studyDay(e.reviewedAt, settings.dayStartsAtHour) === day,
  );
  return summarizeDay(day, events);
}

export function summarizeDay(day: string, events: ReviewEvent[]): TodayStats {
  const stats: TodayStats = { day, newDone: 0, reviewsDone: 0, totalDone: 0, timeMs: 0, knowledgeStudied: new Set(), again: 0 };
  for (const e of events) {
    stats.totalDone++;
    stats.timeMs += e.durationMs;
    stats.knowledgeStudied.add(e.knowledgeId);
    if (e.rating === 1) stats.again++;
    if (e.kind === 'review') {
      if (e.stateBefore === 0) stats.newDone++;
      else if (e.stateBefore === 2) stats.reviewsDone++;
    }
  }
  return stats;
}

export interface QueueOptions {
  settings: Settings;
  filter?: DeckFilter;
  now?: Date;
  /** Límite extra para sesiones cortas (modo rápido). */
  maxCards?: number;
  extraNew?: number;
}

export interface QueueBuild {
  items: QueueItem[];
  counts: { learning: number; review: number; new: number; dueTotal: number; newAvailable: number };
}

export async function buildScheduledQueue(opts: QueueOptions, lib?: Library, today?: TodayStats): Promise<QueueBuild> {
  const now = opts.now ?? new Date();
  const { settings } = opts;
  lib ??= await loadLibrary();
  today ??= await todayStats(settings, now);
  const endOfDay = endOfStudyDay(now, settings.dayStartsAtHour).getTime();
  const learnAhead = now.getTime() + 20 * 60_000;
  const learning: (QueueItem & { due: number })[] = [];
  const reviews: (QueueItem & { due: number; prio: number })[] = [];
  const fresh: (QueueItem & { prio: number; miss: number; order: number; type: number })[] = [];

  for (const card of lib.cards) {
    if (card.suspended) continue;
    const k = lib.knowledge.get(card.knowledgeId);
    if (!k || k.status === 'archived') continue;
    const state = lib.states.get(card.id);
    if (!matchesFilter(k, card, opts.filter, state, settings.leechThreshold)) continue;
    const due = state ? new Date(state.due).getTime() : 0;
    if (!state || state.state === 0) {
      if (k.status === 'mastered') continue;
      fresh.push({ cardId: card.id, knowledgeId: k.id, kind: 'new', prio: k.priority + (k.markedDifficult ? 1 : 0), miss: k.timesMissed, order: hash(card.id + today.day), type: TYPE_ORDER[card.type] ?? 9 });
    } else if (state.state === 1 || state.state === 3) {
      if (due <= learnAhead) learning.push({ cardId: card.id, knowledgeId: k.id, kind: 'learning', due });
    } else if (due < endOfDay) {
      reviews.push({ cardId: card.id, knowledgeId: k.id, kind: 'review', due, prio: k.priority });
    }
  }

  learning.sort((a, b) => a.due - b.due);
  // Vencidas: primero las de días anteriores; dentro del mismo día, mayor prioridad (errores recurrentes).
  reviews.sort((a, b) => Math.floor(a.due / 86_400_000) - Math.floor(b.due / 86_400_000) || b.prio - a.prio || a.due - b.due);
  fresh.sort((a, b) => b.prio - a.prio || b.miss - a.miss || a.type - b.type || a.order - b.order);

  // Tarjetas hermanas: una por conocimiento por día (salvo las que ya están en aprendizaje).
  const usedKnowledge = new Set<string>([...today.knowledgeStudied, ...learning.map((l) => l.knowledgeId)]);
  const reviewLimit = Math.max(0, settings.reviewsPerDay - today.reviewsDone);
  const pickedReviews: QueueItem[] = [];
  for (const r of reviews) {
    if (pickedReviews.length >= reviewLimit) break;
    if (usedKnowledge.has(r.knowledgeId)) continue;
    usedKnowledge.add(r.knowledgeId);
    pickedReviews.push({ cardId: r.cardId, knowledgeId: r.knowledgeId, kind: 'review' });
  }
  const newLimit = Math.max(0, settings.newPerDay - today.newDone) + (opts.extraNew ?? 0);
  const pickedNew: QueueItem[] = [];
  for (const n of fresh) {
    if (pickedNew.length >= newLimit) break;
    if (usedKnowledge.has(n.knowledgeId)) continue;
    usedKnowledge.add(n.knowledgeId);
    pickedNew.push({ cardId: n.cardId, knowledgeId: n.knowledgeId, kind: 'new' });
  }

  // Intercala nuevas entre los repasos para mantener variedad.
  const items: QueueItem[] = learning.map(({ cardId, knowledgeId }) => ({ cardId, knowledgeId, kind: 'learning' as const }));
  const gap = pickedNew.length ? Math.max(1, Math.floor(pickedReviews.length / pickedNew.length)) : Infinity;
  let ni = 0;
  pickedReviews.forEach((r, i) => {
    items.push(r);
    if ((i + 1) % gap === 0 && ni < pickedNew.length) items.push(pickedNew[ni++]);
  });
  while (ni < pickedNew.length) items.push(pickedNew[ni++]);

  const limited = opts.maxCards ? items.slice(0, opts.maxCards) : items;
  // «Sin empezar» = conocimientos con todas sus tarjetas todavía nuevas.
  const touched = new Set<string>();
  for (const s of lib.states.values()) if (s.state !== 0) touched.add(s.knowledgeId);
  const freshKnowledge = new Set(fresh.map((f) => f.knowledgeId).filter((id) => !touched.has(id)));
  return {
    items: limited,
    counts: {
      learning: learning.length,
      review: pickedReviews.length,
      new: pickedNew.length,
      dueTotal: reviews.length + learning.length,
      newAvailable: freshKnowledge.size,
    },
  };
}

export interface CramOptions {
  settings: Settings;
  mode: SessionMode;
  filter?: DeckFilter;
  size?: number;
  now?: Date;
}

/** Repaso intensivo: no modifica la programación FSRS (los repasos se registran como «cram»). */
export async function buildCramQueue(opts: CramOptions, lib?: Library): Promise<QueueItem[]> {
  lib ??= await loadLibrary();
  const now = opts.now ?? new Date();
  const recentAgain = new Set<string>();
  const since = new Date(now.getTime() - 21 * 86_400_000).toISOString();
  for (const e of await db.reviews.where('reviewedAt').above(since).toArray()) {
    if (!e.deleted && e.rating === 1) recentAgain.add(e.cardId);
  }
  const byKnowledge = new Map<string, { item: QueueItem; score: number }[]>();
  for (const card of lib.cards) {
    if (card.suspended) continue;
    const k = lib.knowledge.get(card.knowledgeId);
    if (!k || k.status === 'archived') continue;
    const state = lib.states.get(card.id);
    if (!matchesFilter(k, card, opts.filter, state, opts.settings.leechThreshold)) continue;
    let score = 0;
    if (opts.mode === 'errors') {
      const err = isErrorKnowledge(k) || recentAgain.has(card.id) || (state?.lapses ?? 0) > 0;
      if (!err) continue;
      score = k.timesMissed * 3 + (state?.lapses ?? 0) * 2 + (recentAgain.has(card.id) ? 4 : 0) + k.priority;
    } else if (opts.mode === 'difficult') {
      if (!isDifficult(k, state, opts.settings.leechThreshold) && !recentAgain.has(card.id)) continue;
      score = (state?.lapses ?? 0) * 3 + (state?.difficulty ?? 0);
    } else if (opts.mode === 'favorites') {
      if (!k.favorite) continue;
    }
    const list = byKnowledge.get(k.id) ?? [];
    list.push({ item: { cardId: card.id, knowledgeId: k.id, kind: 'cram' }, score: score + Math.random() });
    byKnowledge.set(k.id, list);
  }
  // Una tarjeta por conocimiento (la más «débil»), ordenadas por puntaje y mezcladas un poco.
  const best = [...byKnowledge.values()].map((list) => list.sort((a, b) => b.score - a.score)[0]);
  best.sort((a, b) => b.score - a.score);
  const size = opts.size ?? 30;
  const top = best.slice(0, Math.max(size * 2, size));
  return shuffle(top).slice(0, size).map((b) => b.item);
}

export interface DueSummary {
  dueNow: number;
  learning: number;
  newToday: number;
  newAvailable: number;
}

export async function dueSummary(settings: Settings, filter?: DeckFilter): Promise<DueSummary> {
  const q = await buildScheduledQueue({ settings, filter });
  return { dueNow: q.counts.review + q.counts.learning, learning: q.counts.learning, newToday: q.counts.new, newAvailable: q.counts.newAvailable };
}
