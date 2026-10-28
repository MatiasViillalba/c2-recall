// Todas las escrituras de la app pasan por acá: actualizan `updatedAt`, encolan el cambio en el outbox
// para sincronizar y nunca reescriben el historial de repasos al editar el texto de una tarjeta.
import { db } from './db';
import {
  applyRating, DEFAULT_SETTINGS, makeScheduler, newCardState, replay, type Grade,
} from './scheduler';
import type {
  Card, CardState, ErrorLog, Knowledge, ReviewEvent, ReviewKind, Settings, SyncedTable,
} from './types';
import { nowIso, uuid } from './util';

type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitChange() {
  for (const fn of listeners) fn();
}

export async function enqueue(table: SyncedTable, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const queuedAt = nowIso();
  await db.outbox.bulkPut(ids.map((id) => ({ key: `${table}:${id}`, table, id, queuedAt })));
  emitChange();
}

let deviceIdCache: string | undefined;
export async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  const row = await db.meta.get('deviceId');
  if (row) return (deviceIdCache = row.value as string);
  deviceIdCache = uuid();
  await db.meta.put({ key: 'deviceId', value: deviceIdCache });
  return deviceIdCache;
}

// ── Ajustes ──
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'settings' as const, updatedAt: nowIso() };
  await db.settings.put(next);
  await enqueue('settings', ['settings']);
  if (patch.theme) {
    try { localStorage.setItem('c2r-theme', patch.theme); } catch { /* almacenamiento bloqueado */ }
  }
  return next;
}

export async function getScheduler() {
  return makeScheduler(await getSettings());
}

// ── Conocimientos y tarjetas ──
const CONTENT_FIELDS: (keyof Knowledge)[] = [
  'expression', 'meaningEs', 'promptEs', 'hint', 'categories', 'examParts', 'pattern', 'examples', 'aliases',
  'wrongAnswers', 'notes', 'confusables', 'family', 'root', 'tags', 'errorType', 'validation',
];

export async function updateKnowledge(id: string, patch: Partial<Knowledge>, opts: { userEdit?: boolean } = {}): Promise<void> {
  const current = await db.knowledge.get(id);
  if (!current) throw new Error(`Conocimiento inexistente: ${id}`);
  const touchesContent = CONTENT_FIELDS.some((f) => f in patch);
  const next: Knowledge = {
    ...current,
    ...patch,
    userEdited: current.userEdited || (opts.userEdit !== false && touchesContent),
    updatedAt: nowIso(),
  };
  await db.knowledge.put(next);
  await enqueue('knowledge', [id]);
}

export async function updateCard(id: string, patch: Partial<Card>, opts: { userEdit?: boolean } = {}): Promise<void> {
  const current = await db.cards.get(id);
  if (!current) throw new Error(`Tarjeta inexistente: ${id}`);
  const contentChange = ['prompt', 'answer', 'alternatives', 'explanation', 'hint', 'original', 'keyword', 'root', 'pos', 'translation'].some((f) => f in patch);
  await db.cards.put({ ...current, ...patch, userEdited: current.userEdited || (opts.userEdit !== false && contentChange), updatedAt: nowIso() });
  await enqueue('cards', [id]);
}

export async function createKnowledge(k: Knowledge, cards: Card[]): Promise<void> {
  const now = nowIso();
  await db.transaction('rw', db.knowledge, db.cards, db.cardStates, db.outbox, async () => {
    await db.knowledge.put({ ...k, updatedAt: now });
    await db.cards.bulkPut(cards.map((c) => ({ ...c, knowledgeId: k.id, updatedAt: now })));
    await db.cardStates.bulkPut(cards.map((c) => newCardState(c.id, k.id)));
  });
  await enqueue('knowledge', [k.id]);
  await enqueue('cards', cards.map((c) => c.id));
}

export async function addCards(knowledgeId: string, cards: Card[]): Promise<void> {
  const now = nowIso();
  await db.cards.bulkPut(cards.map((c) => ({ ...c, knowledgeId, updatedAt: now })));
  await db.cardStates.bulkPut(cards.map((c) => newCardState(c.id, knowledgeId)));
  await enqueue('cards', cards.map((c) => c.id));
}

export async function deleteCard(id: string): Promise<void> {
  await updateCard(id, { deleted: true }, { userEdit: false });
}

export async function setKnowledgeStatus(id: string, status: Knowledge['status']): Promise<void> {
  await updateKnowledge(id, { status }, { userEdit: false });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const k = await db.knowledge.get(id);
  const favorite = !k?.favorite;
  await updateKnowledge(id, { favorite }, { userEdit: false });
  return favorite;
}

export async function setDifficult(id: string, markedDifficult: boolean): Promise<void> {
  const k = await db.knowledge.get(id);
  if (!k) return;
  const priority = markedDifficult ? 3 : k.timesMissed >= 2 ? 3 : k.timesMissed === 1 ? 2 : 1;
  await updateKnowledge(id, { markedDifficult, priority }, { userEdit: false });
}

export async function setCardSuspended(cardId: string, suspended: boolean): Promise<void> {
  await updateCard(cardId, { suspended }, { userEdit: false });
}

export async function flagCard(cardId: string, reason: string): Promise<void> {
  await updateCard(cardId, { flagged: reason ? { reason, at: nowIso() } : undefined }, { userEdit: false });
}

// ── Repasos ──
export interface RecordReviewInput {
  card: Pick<Card, 'id' | 'knowledgeId'>;
  rating: Grade;
  durationMs: number;
  kind?: ReviewKind;
  at?: Date;
}

export interface RecordReviewResult {
  event: ReviewEvent;
  before: CardState;
  after: CardState;
}

export async function recordReview(input: RecordReviewInput): Promise<RecordReviewResult> {
  const at = input.at ?? new Date();
  const kind = input.kind ?? 'review';
  const f = await getScheduler();
  const deviceId = await getDeviceId();
  const before = (await db.cardStates.get(input.card.id)) ?? newCardState(input.card.id, input.card.knowledgeId);
  const after = kind === 'cram' ? before : applyRating(before, input.rating, at, f);
  const iso = at.toISOString();
  const event: ReviewEvent = {
    id: uuid(),
    cardId: input.card.id,
    knowledgeId: input.card.knowledgeId,
    rating: input.rating,
    kind,
    reviewedAt: iso,
    durationMs: Math.max(0, Math.min(input.durationMs, 10 * 60_000)),
    deviceId,
    stateBefore: before.state,
    scheduledDaysAfter: after.scheduledDays,
    dueAfter: after.due,
    createdAt: iso,
    updatedAt: iso,
  };
  await db.transaction('rw', db.reviews, db.cardStates, async () => {
    await db.reviews.add(event);
    if (kind !== 'cram') await db.cardStates.put(after);
  });
  await enqueue('reviews', [event.id]);
  return { event, before, after };
}

/** Deshace un repaso: lo marca como borrado (también en la nube) y restaura el estado anterior. */
export async function undoReview(result: RecordReviewResult): Promise<void> {
  await db.transaction('rw', db.reviews, db.cardStates, async () => {
    await db.reviews.update(result.event.id, { deleted: true, updatedAt: nowIso() });
    if (result.event.kind !== 'cram') await db.cardStates.put(result.before);
  });
  await enqueue('reviews', [result.event.id]);
}

/** Reinicia la tarjeta a «nueva» sin borrar su historial (queda un evento «reset»). */
export async function resetCard(cardId: string): Promise<void> {
  const card = await db.cards.get(cardId);
  if (!card) return;
  const iso = nowIso();
  const event: ReviewEvent = {
    id: uuid(), cardId, knowledgeId: card.knowledgeId, rating: 0, kind: 'reset', reviewedAt: iso,
    durationMs: 0, deviceId: await getDeviceId(), createdAt: iso, updatedAt: iso,
  };
  await db.transaction('rw', db.reviews, db.cardStates, async () => {
    await db.reviews.add(event);
    await db.cardStates.put(newCardState(cardId, card.knowledgeId, new Date(iso)));
  });
  await enqueue('reviews', [event.id]);
}

/** Recalcula el estado FSRS de las tarjetas indicadas a partir de todos sus eventos. */
export async function recomputeCardStates(cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  const f = await getScheduler();
  const unique = Array.from(new Set(cardIds));
  const events = await db.reviews.where('cardId').anyOf(unique).toArray();
  const byCard = new Map<string, ReviewEvent[]>();
  for (const e of events) byCard.set(e.cardId, [...(byCard.get(e.cardId) ?? []), e]);
  const cards = await db.cards.bulkGet(unique);
  const states: CardState[] = [];
  unique.forEach((id, i) => {
    const card = cards[i];
    if (!card) return;
    states.push(replay(id, card.knowledgeId, byCard.get(id) ?? [], f));
  });
  await db.cardStates.bulkPut(states);
}

export async function recomputeAllStates(): Promise<void> {
  const ids = await db.cards.toCollection().primaryKeys();
  for (let i = 0; i < ids.length; i += 400) await recomputeCardStates(ids.slice(i, i + 400) as string[]);
}

/**
 * Registra que volviste a fallar un conocimiento fuera de la app (simulacro, ejercicio nuevo).
 * Sube la prioridad y, si se pide, cuenta como «Again» en las tarjetas ya estudiadas para que FSRS
 * las vuelva a programar pronto, sin borrar nada de su historial.
 */
export async function logRecurrence(knowledgeId: string, info: { wrongAnswer?: string; sourceTitle?: string; note?: string; asLapse?: boolean; at?: string }): Promise<void> {
  const k = await db.knowledge.get(knowledgeId);
  if (!k) return;
  const at = info.at ?? nowIso();
  const log: ErrorLog = {
    id: uuid(), knowledgeId, occurredAt: at, wrongAnswer: info.wrongAnswer, sourceTitle: info.sourceTitle, note: info.note,
    createdAt: at, updatedAt: at,
  };
  await db.errorLogs.add(log);
  await enqueue('errorLogs', [log.id]);
  const wrongAnswers = info.wrongAnswer && !k.wrongAnswers.includes(info.wrongAnswer) ? [...k.wrongAnswers, info.wrongAnswer] : k.wrongAnswers;
  await updateKnowledge(knowledgeId, { timesMissed: k.timesMissed + 1, priority: 3, wrongAnswers, errorType: k.errorType ?? 'error', status: k.status === 'mastered' ? 'active' : k.status }, { userEdit: false });
  if (info.asLapse) {
    const cards = (await db.cards.where('knowledgeId').equals(knowledgeId).toArray()).filter((c) => !c.deleted && !c.suspended);
    for (const card of cards) {
      const st = await db.cardStates.get(card.id);
      if (st && st.state !== 0) await recordReview({ card, rating: 1, durationMs: 0, kind: 'external', at: new Date(at) });
    }
  }
}

/** Fusiona `otherId` dentro de `targetId`: mueve tarjetas e historial y conserva todas las fuentes. */
export async function mergeKnowledge(targetId: string, otherId: string): Promise<void> {
  if (targetId === otherId) return;
  const [target, other] = await db.knowledge.bulkGet([targetId, otherId]);
  if (!target || !other) throw new Error('No se encontraron ambos conocimientos.');
  const uniq = <T,>(arr: T[], key: (x: T) => string) => {
    const seen = new Set<string>();
    return arr.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
  };
  const merged: Partial<Knowledge> = {
    aliases: uniq([...target.aliases, other.expression, ...other.aliases].filter((a) => a !== target.expression), (s) => s.toLowerCase()),
    examples: uniq([...target.examples, ...other.examples], (e) => e.en.toLowerCase()),
    wrongAnswers: uniq([...target.wrongAnswers, ...other.wrongAnswers], (s) => s.toLowerCase()),
    confusables: uniq([...target.confusables, ...other.confusables], (s) => s.toLowerCase()),
    sources: uniq([...target.sources, ...other.sources], (s) => `${s.sourceId}:${s.page}:${s.exercise ?? ''}`),
    categories: Array.from(new Set([...target.categories, ...other.categories])),
    examParts: Array.from(new Set([...target.examParts, ...other.examParts])),
    tags: Array.from(new Set([...target.tags, ...other.tags])),
    family: uniq([...target.family, ...other.family], (f) => f.word.toLowerCase()),
    timesSeen: target.timesSeen + other.timesSeen,
    timesMissed: target.timesMissed + other.timesMissed,
    priority: Math.max(target.priority, other.priority) as 1 | 2 | 3,
    notes: [target.notes, other.notes].filter(Boolean).join('\n\n') || undefined,
  };
  const cards = await db.cards.where('knowledgeId').equals(otherId).toArray();
  await db.transaction('rw', [db.knowledge, db.cards, db.cardStates, db.reviews, db.errorLogs, db.outbox], async () => {
    await updateKnowledge(targetId, merged);
    await updateKnowledge(otherId, { mergedInto: targetId, deleted: true, status: 'archived' }, { userEdit: false });
    for (const c of cards) await updateCard(c.id, { knowledgeId: targetId }, { userEdit: false });
    await db.cardStates.where('knowledgeId').equals(otherId).modify({ knowledgeId: targetId });
    const reviews = await db.reviews.where('knowledgeId').equals(otherId).toArray();
    for (const r of reviews) await db.reviews.put({ ...r, knowledgeId: targetId, updatedAt: nowIso() });
    await enqueue('reviews', reviews.map((r) => r.id));
    const logs = await db.errorLogs.where('knowledgeId').equals(otherId).toArray();
    for (const l of logs) await db.errorLogs.put({ ...l, knowledgeId: targetId, updatedAt: nowIso() });
    await enqueue('errorLogs', logs.map((l) => l.id));
  });
}
