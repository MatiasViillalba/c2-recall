// Datos agregados para el inicio y las estadísticas (se recalculan en vivo cuando cambia la base).
import { db } from './db';
import { buildScheduledQueue, loadLibrary, todayStats } from './queue';
import { makeScheduler } from './scheduler';
import { computeAnalytics, type Analytics } from './stats';
import type { Knowledge, Settings } from './types';

export interface Overview {
  analytics: Analytics;
  today: { done: number; newDone: number; reviewsDone: number; timeMs: number; again: number };
  queue: { learning: number; review: number; new: number; newAvailable: number; dueTotal: number };
  totals: { knowledge: number; cards: number; errors: number; pendingValidation: number };
  knowledgeById: Map<string, Knowledge>;
}

export async function loadOverview(settings: Settings, rangeDays = 182): Promise<Overview> {
  const now = new Date();
  const lib = await loadLibrary();
  const today = await todayStats(settings, now);
  const q = await buildScheduledQueue({ settings, now }, lib, today);
  const reviews = await db.reviews.toArray();
  const activeCardIds = new Set(lib.cards.filter((c) => !c.suspended && lib.knowledge.get(c.knowledgeId)?.status !== 'archived').map((c) => c.id));
  const states = [...lib.states.values()].filter((s) => activeCardIds.has(s.cardId));
  const suspended = new Set(lib.cards.filter((c) => c.suspended).map((c) => c.id));
  const analytics = computeAnalytics({ reviews, states, knowledge: [...lib.knowledge.values()], suspendedCardIds: suspended, settings, f: makeScheduler(settings), now, rangeDays });
  const knowledge = [...lib.knowledge.values()].filter((k) => k.status !== 'archived');
  return {
    analytics,
    today: { done: today.totalDone, newDone: today.newDone, reviewsDone: today.reviewsDone, timeMs: today.timeMs, again: today.again },
    queue: q.counts,
    totals: {
      knowledge: knowledge.length,
      cards: activeCardIds.size,
      errors: knowledge.filter((k) => k.timesMissed > 0 || k.errorType === 'error').length,
      pendingValidation: knowledge.filter((k) => k.validation === 'pending').length,
    },
    knowledgeById: lib.knowledge,
  };
}
