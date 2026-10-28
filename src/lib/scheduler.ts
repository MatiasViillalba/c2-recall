// Programación con FSRS (biblioteca ts-fsrs). El estado de cada tarjeta se deriva SIEMPRE de su historial
// de repasos (event sourcing): así la sincronización entre dispositivos se resuelve uniendo eventos y
// reproduciéndolos en orden, sin pisar el historial ni duplicar repasos.
import {
  createEmptyCard, fsrs, generatorParameters, Rating, State,
  type Card as FsrsCard, type FSRS, type Grade, type StepUnit,
} from 'ts-fsrs';
import type { CardState, ReviewEvent, Settings } from './types';
import { formatInterval } from './util';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  newPerDay: 20,
  reviewsPerDay: 250,
  retention: 0.9,
  maximumInterval: 3650,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  enableFuzz: true,
  dayStartsAtHour: 4,
  theme: 'system',
  autoSpeak: false,
  speechRate: 0.95,
  showHintsByDefault: false,
  dailyGoalMinutes: 20,
  leechThreshold: 4,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const STEP_RE = /^\d+(\.\d+)?[mhd]$/;

export function makeScheduler(settings: Pick<Settings, 'retention' | 'maximumInterval' | 'enableFuzz' | 'learningSteps' | 'relearningSteps'>): FSRS {
  const steps = (s: string[]) => s.filter((x) => STEP_RE.test(x)) as StepUnit[];
  return fsrs(generatorParameters({
    request_retention: settings.retention,
    maximum_interval: settings.maximumInterval,
    enable_fuzz: settings.enableFuzz,
    enable_short_term: true,
    learning_steps: steps(settings.learningSteps),
    relearning_steps: steps(settings.relearningSteps),
  }));
}

export function newCardState(cardId: string, knowledgeId: string, now: Date = new Date(0)): CardState {
  return fromFsrs(createEmptyCard(now), cardId, knowledgeId);
}

export function fromFsrs(card: FsrsCard, cardId: string, knowledgeId: string, firstReview?: string): CardState {
  return {
    cardId,
    knowledgeId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as 0 | 1 | 2 | 3,
    lastReview: card.last_review?.toISOString(),
    firstReview,
  };
}

export function toFsrs(state: CardState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

/** Eventos que afectan la programación (los de «repaso intensivo» no la modifican). */
export function isSchedulingEvent(e: ReviewEvent): boolean {
  return !e.deleted && (e.kind === 'review' || e.kind === 'external' || e.kind === 'reset');
}

export function sortEvents(events: ReviewEvent[]): ReviewEvent[] {
  return events.slice().sort((a, b) => (a.reviewedAt === b.reviewedAt ? a.id.localeCompare(b.id) : a.reviewedAt < b.reviewedAt ? -1 : 1));
}

/** Reconstruye el estado FSRS de una tarjeta reproduciendo su historial en orden cronológico. */
export function replay(cardId: string, knowledgeId: string, events: ReviewEvent[], f: FSRS): CardState {
  let card = createEmptyCard(new Date(0));
  let firstReview: string | undefined;
  for (const e of sortEvents(events)) {
    if (!isSchedulingEvent(e)) continue;
    const at = new Date(e.reviewedAt);
    if (e.kind === 'reset') {
      card = createEmptyCard(at);
      continue;
    }
    if (e.rating < 1 || e.rating > 4) continue;
    firstReview ??= e.reviewedAt;
    card = f.next(card, at, e.rating as Grade).card;
  }
  return fromFsrs(card, cardId, knowledgeId, firstReview);
}

export function applyRating(state: CardState, rating: Grade, at: Date, f: FSRS): CardState {
  const next = f.next(toFsrs(state), at, rating).card;
  return fromFsrs(next, state.cardId, state.knowledgeId, state.firstReview ?? at.toISOString());
}

export interface IntervalPreview {
  rating: Grade;
  label: string;
  due: Date;
}

export function previewIntervals(state: CardState, now: Date, f: FSRS): IntervalPreview[] {
  const preview = f.repeat(toFsrs(state), now);
  return ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]).map((r) => {
    const due = preview[r].card.due;
    return { rating: r, due, label: formatInterval(due.getTime() - now.getTime()) };
  });
}

export function retrievability(state: CardState, now: Date, f: FSRS): number {
  if (state.state === 0 || !state.lastReview) return 0;
  return f.get_retrievability(toFsrs(state), now, false);
}

export const RATING_LABELS: Record<Grade, { label: string; es: string; key: string }> = {
  1: { label: 'Again', es: 'No me acordé', key: '1' },
  2: { label: 'Hard', es: 'Me costó', key: '2' },
  3: { label: 'Good', es: 'Bien', key: '3' },
  4: { label: 'Easy', es: 'Fácil', key: '4' },
};

/** Etiqueta de dificultad legible a partir de la dificultad FSRS (1–10). */
export function difficultyLabel(state: CardState | undefined): 'Nueva' | 'Fácil' | 'Media' | 'Difícil' {
  if (!state || state.state === 0) return 'Nueva';
  if (state.difficulty >= 7 || state.lapses >= 3) return 'Difícil';
  if (state.difficulty >= 4.5) return 'Media';
  return 'Fácil';
}

export { Rating, State };
export type { Grade };
