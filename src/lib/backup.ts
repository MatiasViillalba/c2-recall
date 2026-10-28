// Copias de seguridad: exportación completa a JSON (restaurable) y CSV (para planillas).
import { db } from './db';
import { enqueue, recomputeAllStates } from './repo';
import type { Card, CardState, Knowledge, ReviewEvent, SyncedTable } from './types';
import { nowIso } from './util';
import { SEED_TIME } from './content/constants.ts';

export const BACKUP_FORMAT = 'c2-recall/backup';

const TABLES = ['knowledge', 'cards', 'cardStates', 'reviews', 'errorLogs', 'decks', 'sources', 'importBatches', 'settings', 'meta'] as const;
type TableName = (typeof TABLES)[number];

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  data.meta = (data.meta as { key: string }[]).filter((m) => !['deviceId', 'syncCursor', 'supabaseSession'].includes(m.key));
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: nowIso(), app: 'C2 Recall', data });
}

export interface RestoreSummary {
  knowledge: number;
  cards: number;
  reviews: number;
}

/**
 * Restaura una copia. «replace» borra lo local y lo reemplaza; «merge» conserva lo más reciente de cada
 * registro y une los historiales de repaso (sin duplicar eventos, que tienen id único).
 */
export async function restoreBackup(text: string, mode: 'replace' | 'merge'): Promise<RestoreSummary> {
  const parsed = JSON.parse(text) as { format?: string; data?: Record<TableName, unknown[]> };
  if (parsed.format !== BACKUP_FORMAT || !parsed.data) throw new Error('This file is not a C2 Recall backup.');
  const data = parsed.data;
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    if (mode === 'replace') for (const t of TABLES) if (t !== 'meta') await db.table(t).clear();
    for (const t of TABLES) {
      const rows = (data[t] ?? []) as Record<string, unknown>[];
      if (!rows.length || t === 'cardStates') continue;
      if (mode === 'replace' || t === 'reviews' || t === 'meta') {
        if (t === 'meta') await db.meta.bulkPut((rows as { key: string; value: unknown }[]).filter((m) => m.key !== 'deviceId'));
        else await db.table(t).bulkPut(rows);
        continue;
      }
      const keyName = t === 'settings' ? 'id' : 'id';
      const existing = await db.table(t).bulkGet(rows.map((r) => r[keyName] as string));
      await db.table(t).bulkPut(rows.filter((r, i) => {
        const cur = existing[i] as { updatedAt?: string } | undefined;
        return !cur || (cur.updatedAt ?? '') < ((r.updatedAt as string) ?? '');
      }));
    }
  });
  await recomputeAllStates();
  // Todo lo restaurado que no venga del seed queda pendiente de subir a la nube.
  const pending: [SyncedTable, string[]][] = [
    ['knowledge', (await db.knowledge.toArray()).filter((k) => k.origin !== 'seed' || k.userEdited || k.updatedAt > SEED_TIME).map((k) => k.id)],
    ['cards', (await db.cards.toArray()).filter((c) => c.origin !== 'seed' || c.userEdited || c.updatedAt > SEED_TIME).map((c) => c.id)],
    ['reviews', (await db.reviews.toCollection().primaryKeys()) as string[]],
    ['errorLogs', (await db.errorLogs.toCollection().primaryKeys()) as string[]],
    ['importBatches', (await db.importBatches.toCollection().primaryKeys()) as string[]],
    ['decks', (await db.decks.toArray()).filter((d) => !d.builtIn).map((d) => d.id)],
    ['settings', ['settings']],
  ];
  for (const [table, ids] of pending) await enqueue(table, ids);
  return { knowledge: await db.knowledge.count(), cards: await db.cards.count(), reviews: await db.reviews.count() };
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
}

export function knowledgeCsv(knowledge: Knowledge[]): string {
  return toCsv(
    ['id', 'expression', 'meaning_es', 'categories', 'parts', 'pattern', 'example_en', 'example_es', 'notes', 'wrong', 'confusables', 'times_missed', 'priority', 'error_type', 'validation', 'status', 'sources'],
    knowledge.filter((k) => !k.deleted).map((k) => [k.id, k.expression, k.meaningEs, k.categories, k.examParts, k.pattern, k.examples[0]?.en.replace(/\{\{|\}\}/g, ''), k.examples[0]?.es, k.notes, k.wrongAnswers, k.confusables, k.timesMissed, k.priority, k.errorType, k.validation, k.status, k.sources.map((s) => `${s.sourceId} p.${s.page ?? '?'}`)]),
  );
}

export function cardsCsv(cards: Card[], states: Map<string, CardState>): string {
  return toCsv(
    ['id', 'knowledge_id', 'type', 'prompt', 'answer', 'alternatives', 'state', 'due', 'stability', 'difficulty', 'reps', 'lapses', 'suspended'],
    cards.filter((c) => !c.deleted).map((c) => {
      const s = states.get(c.id);
      return [c.id, c.knowledgeId, c.type, c.prompt, c.answer, c.alternatives, s?.state ?? 0, s?.due, s?.stability?.toFixed(2), s?.difficulty?.toFixed(2), s?.reps ?? 0, s?.lapses ?? 0, c.suspended ? 1 : 0];
    }),
  );
}

export function reviewsCsv(reviews: ReviewEvent[]): string {
  return toCsv(['id', 'card_id', 'knowledge_id', 'rating', 'kind', 'reviewed_at', 'duration_ms', 'device'], reviews.filter((r) => !r.deleted).map((r) => [r.id, r.cardId, r.knowledgeId, r.rating, r.kind, r.reviewedAt, r.durationMs, r.deviceId.slice(0, 8)]));
}
