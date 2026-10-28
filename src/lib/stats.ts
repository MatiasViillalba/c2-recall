// Estadísticas: todo se calcula localmente a partir del historial de repasos y del estado FSRS.
import type { FSRS } from 'ts-fsrs';
import { retrievability } from './scheduler';
import type { CardState, Category, ExamPart, Knowledge, ReviewEvent, Settings } from './types';
import { addDays, studyDay } from './util';

export interface DayPoint {
  day: string;
  reviews: number;
  correct: number;
  timeMs: number;
  newCards: number;
}

export interface Analytics {
  days: DayPoint[];
  streak: number;
  longestStreak: number;
  studiedDays: number;
  totalReviews: number;
  totalTimeMs: number;
  retention30: number | null;
  trueRetentionCount: number;
  estimatedRecall: number | null;
  counts: { new: number; learning: number; young: number; mature: number; relearning: number; suspended: number; total: number };
  forecast: { day: string; due: number }[];
  byPart: { key: ExamPart; total: number; mature: number; studied: number }[];
  byCategory: { key: Category; total: number; mature: number; studied: number }[];
  hardest: { knowledgeId: string; lapses: number; difficulty: number }[];
  recurring: { knowledgeId: string; timesMissed: number }[];
  week: { day: string; reviews: number }[];
  monthly: { month: string; reviews: number; retention: number | null }[];
}

export function computeAnalytics(input: {
  reviews: ReviewEvent[];
  states: CardState[];
  knowledge: Knowledge[];
  suspendedCardIds: Set<string>;
  settings: Settings;
  f: FSRS;
  now?: Date;
  rangeDays?: number;
}): Analytics {
  const now = input.now ?? new Date();
  const startHour = input.settings.dayStartsAtHour;
  const today = studyDay(now, startHour);
  const rangeDays = input.rangeDays ?? 182;
  const reviews = input.reviews.filter((r) => !r.deleted && r.kind !== 'reset');
  const byDay = new Map<string, DayPoint>();
  for (const r of reviews) {
    const d = studyDay(r.reviewedAt, startHour);
    const p = byDay.get(d) ?? { day: d, reviews: 0, correct: 0, timeMs: 0, newCards: 0 };
    p.reviews++;
    if (r.rating > 1) p.correct++;
    p.timeMs += r.durationMs;
    if (r.stateBefore === 0 && r.kind === 'review') p.newCards++;
    byDay.set(d, p);
  }
  const days: DayPoint[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    days.push(byDay.get(d) ?? { day: d, reviews: 0, correct: 0, timeMs: 0, newCards: 0 });
  }

  // Racha: días consecutivos con repasos hasta hoy (si hoy todavía no estudiaste, cuenta desde ayer).
  let streak = 0;
  let cursor = byDay.has(today) ? today : addDays(today, -1);
  while (byDay.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const sortedDays = [...byDay.keys()].sort();
  let longest = 0, run = 0, prev = '';
  for (const d of sortedDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // Retención real: repasos de tarjetas en estado «Review» de los últimos 30 días respondidos sin «Again».
  const since30 = addDays(today, -29);
  const matureReviews = reviews.filter((r) => r.kind !== 'cram' && r.stateBefore === 2 && studyDay(r.reviewedAt, startHour) >= since30);
  const retention30 = matureReviews.length ? matureReviews.filter((r) => r.rating > 1).length / matureReviews.length : null;

  const counts = { new: 0, learning: 0, young: 0, mature: 0, relearning: 0, suspended: input.suspendedCardIds.size, total: input.states.length };
  let rSum = 0, rN = 0;
  const forecastMap = new Map<string, number>();
  for (const s of input.states) {
    if (input.suspendedCardIds.has(s.cardId)) continue;
    if (s.state === 0) counts.new++;
    else if (s.state === 1) counts.learning++;
    else if (s.state === 3) counts.relearning++;
    else if (s.scheduledDays >= 21) counts.mature++;
    else counts.young++;
    if (s.state === 2) {
      rSum += retrievability(s, now, input.f);
      rN++;
    }
    if (s.state !== 0) {
      const d = studyDay(s.due, startHour);
      const key = d < today ? today : d;
      forecastMap.set(key, (forecastMap.get(key) ?? 0) + 1);
    }
  }
  const forecast = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i);
    return { day: d, due: forecastMap.get(d) ?? 0 };
  });

  const statesByKnowledge = new Map<string, CardState[]>();
  for (const s of input.states) statesByKnowledge.set(s.knowledgeId, [...(statesByKnowledge.get(s.knowledgeId) ?? []), s]);
  const partAgg = new Map<ExamPart, { total: number; mature: number; studied: number }>();
  const catAgg = new Map<Category, { total: number; mature: number; studied: number }>();
  const hardest: Analytics['hardest'] = [];
  for (const k of input.knowledge) {
    if (k.deleted || k.status === 'archived') continue;
    const st = statesByKnowledge.get(k.id) ?? [];
    const studied = st.some((s) => s.state !== 0);
    const mature = st.length > 0 && st.every((s) => s.state === 2 && s.scheduledDays >= 21);
    for (const p of k.examParts) {
      const a = partAgg.get(p) ?? { total: 0, mature: 0, studied: 0 };
      a.total++; if (mature) a.mature++; if (studied) a.studied++;
      partAgg.set(p, a);
    }
    for (const c of k.categories) {
      const a = catAgg.get(c) ?? { total: 0, mature: 0, studied: 0 };
      a.total++; if (mature) a.mature++; if (studied) a.studied++;
      catAgg.set(c, a);
    }
    const lapses = st.reduce((n, s) => n + s.lapses, 0);
    const difficulty = st.length ? Math.max(...st.map((s) => (s.state === 0 ? 0 : s.difficulty))) : 0;
    if (lapses > 0 || difficulty >= 7) hardest.push({ knowledgeId: k.id, lapses, difficulty });
  }
  hardest.sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { day: d, reviews: byDay.get(d)?.reviews ?? 0 };
  });

  const monthAgg = new Map<string, { reviews: number; mature: number; correct: number }>();
  for (const r of reviews) {
    const m = studyDay(r.reviewedAt, startHour).slice(0, 7);
    const a = monthAgg.get(m) ?? { reviews: 0, mature: 0, correct: 0 };
    a.reviews++;
    if (r.stateBefore === 2 && r.kind !== 'cram') { a.mature++; if (r.rating > 1) a.correct++; }
    monthAgg.set(m, a);
  }
  const monthly = [...monthAgg.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([month, a]) => ({ month, reviews: a.reviews, retention: a.mature ? a.correct / a.mature : null }));

  return {
    days,
    streak,
    longestStreak: longest,
    studiedDays: byDay.size,
    totalReviews: reviews.length,
    totalTimeMs: reviews.reduce((n, r) => n + r.durationMs, 0),
    retention30,
    trueRetentionCount: matureReviews.length,
    estimatedRecall: rN ? rSum / rN : null,
    counts,
    forecast,
    byPart: [...partAgg.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key)),
    byCategory: [...catAgg.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total),
    hardest: hardest.slice(0, 25),
    recurring: input.knowledge.filter((k) => !k.deleted && k.timesMissed > 0).sort((a, b) => b.timesMissed - a.timesMissed).slice(0, 25).map((k) => ({ knowledgeId: k.id, timesMissed: k.timesMissed })),
    week,
    monthly,
  };
}
