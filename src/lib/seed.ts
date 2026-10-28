// Instalación y actualización del banco inicial (public/seed/seed.json).
// Reglas: nunca se tocan el historial ni el estado FSRS; lo que editaste vos no se pisa;
// los conocimientos nuevos del seed se agregan y los existentes solo actualizan su texto.
import { db, getMeta, setMeta } from './db';
import { newCardState } from './scheduler';
import type { Card, CardState, Deck, Knowledge, Source } from './types';

export interface SeedFile {
  format: 'c2-recall/seed';
  schemaVersion: number;
  seedVersion: string;
  generatedAt: string;
  knowledge: Knowledge[];
  cards: Card[];
  sources: Source[];
  decks: Deck[];
}

export async function fetchSeed(): Promise<SeedFile> {
  const res = await fetch(`${import.meta.env.BASE_URL}seed/seed.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el banco inicial (${res.status}).`);
  return (await res.json()) as SeedFile;
}

const KNOWLEDGE_CONTENT: (keyof Knowledge)[] = [
  'expression', 'meaningEs', 'promptEs', 'hint', 'categories', 'examParts', 'pattern', 'examples', 'aliases',
  'wrongAnswers', 'notes', 'confusables', 'family', 'root', 'tags', 'errorType', 'validation',
];
const CARD_CONTENT: (keyof Card)[] = ['type', 'prompt', 'hint', 'original', 'keyword', 'root', 'pos', 'answer', 'alternatives', 'explanation', 'translation'];

export interface SeedInstallResult {
  installed: boolean;
  knowledgeAdded: number;
  knowledgeUpdated: number;
  cardsAdded: number;
  cardsUpdated: number;
}

export async function installSeed(seed: SeedFile, opts: { force?: boolean } = {}): Promise<SeedInstallResult> {
  const result: SeedInstallResult = { installed: false, knowledgeAdded: 0, knowledgeUpdated: 0, cardsAdded: 0, cardsUpdated: 0 };
  const current = await getMeta<string | null>('seedVersion', null);
  if (current === seed.seedVersion && !opts.force) return result;

  await db.transaction('rw', [db.knowledge, db.cards, db.cardStates, db.sources, db.decks, db.meta], async () => {
    // Las fuentes del seed (los tres PDF) pertenecen al seed: se reescriben siempre.
    await db.sources.bulkPut(seed.sources);

    const decks = await db.decks.bulkGet(seed.decks.map((d) => d.id));
    await db.decks.bulkPut(seed.decks.filter((d, i) => {
      const cur = decks[i];
      return !cur || (cur.builtIn && cur.updatedAt <= d.updatedAt && !cur.deleted);
    }));

    const existingK = await db.knowledge.bulkGet(seed.knowledge.map((k) => k.id));
    const toPutK: Knowledge[] = [];
    seed.knowledge.forEach((k, i) => {
      const cur = existingK[i];
      if (!cur) {
        toPutK.push(k);
        result.knowledgeAdded++;
        return;
      }
      if (cur.origin !== 'seed' || cur.userEdited || cur.deleted) return;
      const next: Knowledge = { ...cur };
      for (const f of KNOWLEDGE_CONTENT) (next as unknown as Record<string, unknown>)[f] = k[f];
      const seedSourceIds = new Set(k.sources.map((s) => s.sourceId));
      next.sources = [...k.sources, ...cur.sources.filter((s) => !seedSourceIds.has(s.sourceId))];
      next.timesMissed = Math.max(cur.timesMissed, k.timesMissed);
      next.priority = Math.max(cur.priority, k.priority) as 1 | 2 | 3;
      toPutK.push(next);
      result.knowledgeUpdated++;
    });
    await db.knowledge.bulkPut(toPutK);

    const existingC = await db.cards.bulkGet(seed.cards.map((c) => c.id));
    const toPutC: Card[] = [];
    const newStates: CardState[] = [];
    seed.cards.forEach((c, i) => {
      const cur = existingC[i];
      if (!cur) {
        toPutC.push(c);
        newStates.push(newCardState(c.id, c.knowledgeId));
        result.cardsAdded++;
        return;
      }
      if (cur.origin !== 'seed' || cur.userEdited || cur.deleted) return;
      const next: Card = { ...cur };
      for (const f of CARD_CONTENT) (next as unknown as Record<string, unknown>)[f] = c[f];
      toPutC.push(next);
      result.cardsUpdated++;
    });
    await db.cards.bulkPut(toPutC);
    // Solo se crea estado para tarjetas nuevas: el estado de las existentes nunca se toca.
    const haveState = new Set(await db.cardStates.where('cardId').anyOf(newStates.map((s) => s.cardId)).primaryKeys());
    await db.cardStates.bulkPut(newStates.filter((s) => !haveState.has(s.cardId)));
    await setMeta('seedVersion', seed.seedVersion);
    await setMeta('seedInstalledAt', new Date().toISOString());
  });
  result.installed = true;
  return result;
}

export async function ensureSeed(): Promise<SeedInstallResult | null> {
  try {
    const seed = await fetchSeed();
    return await installSeed(seed);
  } catch (err) {
    console.warn('[seed]', err);
    return null;
  }
}
