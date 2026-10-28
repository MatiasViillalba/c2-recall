import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { installSeed } from '../src/lib/seed';
import { buildCramQueue, buildScheduledQueue, loadLibrary } from '../src/lib/queue';
import {
  createKnowledge, getSettings, mergeKnowledge, recomputeAllStates, recordReview, resetCard, saveSettings, undoReview, updateCard, updateKnowledge,
} from '../src/lib/repo';
import { applyImport, parseImportText, planImport } from '../src/lib/importer';
import { exportAll, restoreBackup } from '../src/lib/backup';
import { normalizeItem } from '../src/lib/content/normalize.ts';
import { freshDB, loadSeed, seededDB } from './helpers';

describe('banco inicial (seed)', () => {
  beforeEach(async () => { await seededDB(); });

  it('instala todos los conocimientos y tarjetas con estado nuevo', async () => {
    const seed = loadSeed();
    expect(await db.knowledge.count()).toBe(seed.knowledge.length);
    expect(await db.cards.count()).toBe(seed.cards.length);
    expect(await db.cardStates.count()).toBe(seed.cards.length);
    expect(seed.knowledge.length).toBeGreaterThan(600);
    // Muestra obligatoria pedida en el enunciado
    for (const id of ['work-like-magic', 'get-off-to-a-flying-start', 'dawn-on', 'at-a-loss', 'take-exception-to', 'make-an-exception-for', 'talk-someone-into-out-of',
      'come-to-an-understanding', 'have-a-discussion-with-about', 'get-something-out-of-the-way', 'take-it-as-read', 'make-a-point-of', 'have-someone-do', 'have-someone-doing',
      'be-kept-waiting', 'be-made-to', 'on-the-point-of', 'at-the-drop-of-a-hat', 'in-this-day-and-age', 'now-and-again', 'it-will-only-take-me-a-second',
      'secure-in-the-knowledge-that', 'more-often-than-not', 'put-up-with', 'at-ease-with', 'had-it-not-been-for', 'should-subject-verb', 'as-a-last-resort', 'only-by-can-we',
      'take-no-notice-of', 'go-into-ing', 'amount-to', 'highly-prized', 'pile-on-vs-pile-up', 'wear-thin', 'hand-in-ones-resignation', 'cordon-off', 'wf-acquisition', 'wf-educated',
      'wf-likelihood', 'wf-irresistible', 'wf-rarity', 'have-something-to-do-with', 'bring-out-the-best-in', 'justified-in', 'come-to-be-regarded-as', 'put-something-down-to']) {
      expect(await db.knowledge.get(id), id).toBeTruthy();
    }
  });

  it('reinstalar la misma versión no hace nada', async () => {
    const r = await installSeed(loadSeed());
    expect(r.installed).toBe(false);
  });

  it('una actualización del seed no pisa lo editado ni toca historial/estado FSRS', async () => {
    const card = (await db.cards.where('knowledgeId').equals('work-like-magic').first())!;
    const { after } = await recordReview({ card, rating: 3, durationMs: 4000 });
    await updateKnowledge('dawn-on', { meaningEs: 'MI TEXTO' });
    const seed = loadSeed();
    const modified = {
      ...seed,
      seedVersion: 'next',
      knowledge: seed.knowledge.map((k) => (k.id === 'dawn-on' || k.id === 'work-like-magic' ? { ...k, meaningEs: 'CAMBIO DEL SEED' } : k)),
      cards: [...seed.cards, { ...seed.cards[0], id: 'brand-new-card', prompt: 'Nueva' }],
    };
    const res = await installSeed(modified);
    expect(res.cardsAdded).toBe(1);
    expect((await db.knowledge.get('dawn-on'))!.meaningEs).toBe('MI TEXTO');
    expect((await db.knowledge.get('work-like-magic'))!.meaningEs).toBe('CAMBIO DEL SEED');
    expect(await db.cardStates.get(card.id)).toEqual(after);
    expect(await db.reviews.where('cardId').equals(card.id).count()).toBe(1);
  });
});

describe('cola de estudio', () => {
  beforeEach(async () => { await seededDB(); });

  it('respeta el límite de nuevas, una tarjeta por conocimiento y prioriza errores', async () => {
    const settings = await getSettings();
    const lib = await loadLibrary();
    const q = await buildScheduledQueue({ settings }, lib);
    expect(q.items.length).toBe(settings.newPerDay);
    expect(new Set(q.items.map((i) => i.knowledgeId)).size).toBe(q.items.length);
    for (const item of q.items) expect(lib.knowledge.get(item.knowledgeId)!.priority).toBe(3);
  });

  it('después de estudiar, las nuevas restantes del día bajan', async () => {
    const settings = await saveSettings({ newPerDay: 5 });
    const q1 = await buildScheduledQueue({ settings });
    for (const item of q1.items.slice(0, 3)) {
      const card = (await db.cards.get(item.cardId))!;
      await recordReview({ card, rating: 3, durationMs: 1000 });
    }
    const q2 = await buildScheduledQueue({ settings });
    expect(q2.counts.new).toBe(2);
    expect(q2.counts.learning).toBe(3);
  });

  it('filtra por parte del examen y el modo intensivo no altera FSRS', async () => {
    const settings = await getSettings();
    const lib = await loadLibrary();
    const q = await buildScheduledQueue({ settings, filter: { parts: ['P3'] } }, lib);
    for (const item of q.items) expect(lib.knowledge.get(item.knowledgeId)!.examParts).toContain('P3');
    const cram = await buildCramQueue({ settings, mode: 'errors', size: 10 }, lib);
    expect(cram.length).toBe(10);
    const card = (await db.cards.get(cram[0].cardId))!;
    const before = await db.cardStates.get(card.id);
    await recordReview({ card, rating: 1, durationMs: 1000, kind: 'cram' });
    expect(await db.cardStates.get(card.id)).toEqual(before);
  });
});

describe('repasos', () => {
  beforeEach(async () => { await seededDB(); });

  it('deshacer restaura el estado anterior y marca el evento como borrado', async () => {
    const card = (await db.cards.get('work-like-magic:es2en:auto'))!;
    const before = await db.cardStates.get(card.id);
    const r = await recordReview({ card, rating: 4, durationMs: 2000 });
    expect((await db.cardStates.get(card.id))!.state).not.toBe(0);
    await undoReview(r);
    expect(await db.cardStates.get(card.id)).toEqual(before);
    expect((await db.reviews.get(r.event.id))!.deleted).toBe(true);
    expect(await db.outbox.get(`reviews:${r.event.id}`)).toBeTruthy();
  });

  it('reiniciar conserva el historial y recalcular desde eventos reproduce el estado', async () => {
    const card = (await db.cards.get('dawn-on:es2en:auto'))!;
    await recordReview({ card, rating: 3, durationMs: 1000, at: new Date('2026-01-01T10:00:00Z') });
    await recordReview({ card, rating: 3, durationMs: 1000, at: new Date('2026-01-01T10:15:00Z') });
    const s = await db.cardStates.get(card.id);
    await db.cardStates.clear();
    await recomputeAllStates();
    expect(await db.cardStates.get(card.id)).toEqual(s);
    await resetCard(card.id);
    expect((await db.cardStates.get(card.id))!.state).toBe(0);
    expect(await db.reviews.where('cardId').equals(card.id).count()).toBe(3);
  });

  it('editar el texto de una tarjeta no modifica su programación', async () => {
    const card = (await db.cards.get('take-exception-to:es2en:auto'))!;
    const r = await recordReview({ card, rating: 3, durationMs: 1000 });
    await updateCard(card.id, { prompt: 'ofenderse por algo (texto editado)' });
    expect(await db.cardStates.get(card.id)).toEqual(r.after);
    expect((await db.cards.get(card.id))!.userEdited).toBe(true);
  });
});

describe('importación', () => {
  beforeEach(async () => { await seededDB(); });

  const payload = {
    format: 'c2-recall/v1',
    batch: { title: 'Mock 4', source: { title: 'Mock Exam 4', kind: 'mock' } },
    items: [
      { expression: 'bury the hatchet', meaningEs: 'hacer las paces', categories: ['idiom'], examParts: ['P1'], examples: [['After years apart, they finally {{buried the hatchet}}.', 'Después de años, por fin hicieron las paces.']] },
      { expression: 'Work like magic', meaningEs: 'funcionar de maravilla', categories: ['idiom'], examParts: ['P4'], wrongAnswers: ['had a magic effect again'], errorType: 'error',
        cards: [{ type: 'kwt', original: 'The remedy was extremely effective.', keyword: 'MAGIC', prompt: 'The remedy ____.', answer: 'worked like magic' }] },
      { expression: 'take exception to', meaningEs: 'ofenderse por', examples: [['He took exception to the joke.', 'Se ofendió por el chiste.']] },
      { expression: 'bury the hatchet', meaningEs: 'hacer las paces (duplicado en el lote)', examples: [['We should {{bury the hatchet}}.', 'Deberíamos hacer las paces.']] },
    ],
  };

  it('detecta nuevos, existentes, recurrencias y duplicados del lote', async () => {
    const plan = await planImport(parseImportText(JSON.stringify(payload)));
    expect(plan.entries.map((e) => e.action)).toEqual(['add', 'recurrence', 'update', 'skip']);
    expect(plan.entries[1].existing!.id).toBe('work-like-magic');
    expect(plan.entries[1].newCards.map((c) => c.type)).toEqual(['kwt']);
  });

  it('aplica sin duplicar ni reiniciar el historial y registra la recurrencia como Again', async () => {
    const card = (await db.cards.get('work-like-magic:es2en:auto'))!;
    await recordReview({ card, rating: 3, durationMs: 1000, at: new Date(Date.now() - 3 * 86_400_000) });
    await recordReview({ card, rating: 3, durationMs: 1000, at: new Date(Date.now() - 3 * 86_400_000 + 15 * 60_000) });
    const knowledgeBefore = await db.knowledge.count();
    const k0 = (await db.knowledge.get('work-like-magic'))!;
    const plan = await planImport(parseImportText(JSON.stringify(payload)));
    const batch = await applyImport(plan, { via: 'file', registerLapse: true });
    expect(batch.added).toBe(1);
    expect(batch.recurrences).toBe(1);
    expect(batch.updated).toBe(1);
    expect(await db.knowledge.count()).toBe(knowledgeBefore + 1);
    const k1 = (await db.knowledge.get('work-like-magic'))!;
    expect(k1.timesMissed).toBe(k0.timesMissed + 1);
    expect(k1.priority).toBe(3);
    expect(k1.wrongAnswers).toContain('had a magic effect again');
    const events = await db.reviews.where('cardId').equals(card.id).toArray();
    expect(events.filter((e) => e.kind === 'review')).toHaveLength(2);
    expect(events.filter((e) => e.kind === 'external' && e.rating === 1)).toHaveLength(1);
    expect((await db.cardStates.get(card.id))!.lapses).toBeGreaterThanOrEqual(1);
    const hatchet = (await db.knowledge.toArray()).find((k) => k.expression === 'bury the hatchet')!;
    expect(hatchet.examples).toHaveLength(2);
    expect(await db.importBatches.count()).toBe(1);
    expect((await db.sources.toArray()).some((s) => s.title === 'Mock Exam 4')).toBe(true);
    // Reimportar lo mismo no duplica conocimientos
    const plan2 = await planImport(parseImportText(JSON.stringify({ ...payload, items: [payload.items[0]] })));
    expect(plan2.entries[0].action).toBe('skip');
  });

  it('acepta CSV con encabezados', async () => {
    const csv = 'expression,meaning_es,categories,parts,example_en,example_es\n"loom large","cobrar gran importancia","idiom","P2","Exams {{loom large}} in May.","Los exámenes pesan mucho en mayo."\n"a brand new chunk","un chunk nuevo","chunk","P2","It is {{a brand new chunk}}.",""';
    const plan = await planImport(parseImportText(csv));
    expect(plan.entries.map((e) => e.action)).toEqual(['update', 'add']);
  });

  it('informa JSON inválido con un mensaje claro', () => {
    expect(() => parseImportText('{ items: [ }')).toThrow(/JSON inválido/);
  });
});

describe('fusión de duplicados', () => {
  beforeEach(async () => { await seededDB(); });
  it('mueve tarjetas e historial y conserva fuentes', async () => {
    const now = new Date().toISOString();
    const { knowledge, cards } = normalizeItem({ id: 'dup-magic', t: 'works like magic', es: 'anda de maravilla', ex: [['It {{works like magic}}.', 'Anda de maravilla.']], src: [] }, { now, origin: 'manual', resolveSource: () => [] });
    await createKnowledge(knowledge, cards);
    await recordReview({ card: cards[0], rating: 3, durationMs: 1000 });
    await mergeKnowledge('work-like-magic', 'dup-magic');
    expect((await db.knowledge.get('dup-magic'))!.deleted).toBe(true);
    expect((await db.cards.get(cards[0].id))!.knowledgeId).toBe('work-like-magic');
    expect((await db.reviews.where('knowledgeId').equals('work-like-magic').count())).toBe(1);
    expect((await db.knowledge.get('work-like-magic'))!.aliases).toContain('works like magic');
  });
});

describe('copias de seguridad', () => {
  it('exportar y restaurar en otro dispositivo conserva todo', async () => {
    await seededDB();
    const card = (await db.cards.get('dawn-on:es2en:auto'))!;
    await recordReview({ card, rating: 3, durationMs: 1000 });
    await updateKnowledge('dawn-on', { notes: 'nota mía' });
    const backup = await exportAll();
    const state = await db.cardStates.get(card.id);
    freshDB();
    await installSeed(loadSeed());
    const r = await restoreBackup(backup, 'replace');
    expect(r.reviews).toBe(1);
    expect((await db.knowledge.get('dawn-on'))!.notes).toBe('nota mía');
    expect(await db.cardStates.get(card.id)).toEqual(state);
  });

  it('rechaza archivos que no son copias', async () => {
    freshDB();
    await expect(restoreBackup('{"hello":1}', 'merge')).rejects.toThrow(/not a C2 Recall backup/);
  });
});
