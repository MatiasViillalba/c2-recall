// Base de datos local (IndexedDB vía Dexie). Es la fuente de verdad: la app funciona 100 % offline
// y Supabase solo se usa para sincronizar entre dispositivos.
import Dexie, { type EntityTable } from 'dexie';
import type {
  Card, CardState, Deck, ErrorLog, ImportBatch, Knowledge, OutboxEntry, ReviewEvent, Settings, Source,
} from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export type C2DB = Dexie & {
  knowledge: EntityTable<Knowledge, 'id'>;
  cards: EntityTable<Card, 'id'>;
  cardStates: EntityTable<CardState, 'cardId'>;
  reviews: EntityTable<ReviewEvent, 'id'>;
  errorLogs: EntityTable<ErrorLog, 'id'>;
  decks: EntityTable<Deck, 'id'>;
  sources: EntityTable<Source, 'id'>;
  importBatches: EntityTable<ImportBatch, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
  outbox: EntityTable<OutboxEntry, 'key'>;
};

export function createDB(name = 'c2-recall'): C2DB {
  const db = new Dexie(name) as C2DB;
  db.version(1).stores({
    knowledge: 'id, updatedAt, priority, status, origin, *categories, *examParts, *tags',
    cards: 'id, knowledgeId, type, updatedAt',
    cardStates: 'cardId, knowledgeId, due, state',
    reviews: 'id, cardId, knowledgeId, reviewedAt, kind, updatedAt',
    errorLogs: 'id, knowledgeId, occurredAt',
    decks: 'id, updatedAt',
    sources: 'id',
    importBatches: 'id, createdAt',
    settings: 'id',
    meta: 'key',
    outbox: 'key, table, queuedAt',
  });
  return db;
}

export let db: C2DB = createDB();

/** Solo para pruebas: reemplaza la instancia global. */
export function useTestDB(name: string): C2DB {
  db = createDB(name);
  return db;
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
