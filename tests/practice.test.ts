import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { categoryOf, deckSnapshot, isFlashCard, markedSegments, splitFront } from '../src/lib/practice';
import { DEFAULT_SETTINGS } from '../src/lib/scheduler';
import type { Library, TodayStats } from '../src/lib/queue';
import type { Card, CardState, Knowledge } from '../src/lib/types';

const seed = JSON.parse(readFileSync('public/seed/seed.json', 'utf8')) as { knowledge: Knowledge[]; cards: Card[] };
const byId = new Map(seed.knowledge.map((k) => [k.id, k]));
const flash = seed.cards.filter((c) => isFlashCard(c, byId.get(c.knowledgeId)));
const lib = (states: CardState[] = []): Library => ({
  knowledge: new Map(byId),
  cards: seed.cards,
  states: new Map(states.map((s) => [s.cardId, s])),
});
const today = (patch: Partial<TodayStats> = {}): TodayStats => ({
  day: '2026-11-01', newDone: 0, reviewsDone: 0, totalDone: 0, timeMs: 0, knowledgeStudied: new Set(), again: 0, ...patch,
});
const NOW = new Date('2026-11-01T15:00:00Z');
const state = (card: Card, patch: Partial<CardState>): CardState => ({
  cardId: card.id, knowledgeId: card.knowledgeId, due: NOW.toISOString(), stability: 5, difficulty: 5, scheduledDays: 5,
  learningSteps: 0, reps: 3, lapses: 0, state: 2, lastReview: '2026-10-27T15:00:00Z', ...patch,
});

describe('banco de flashcards', () => {
  it('tiene más de mil flashcards, todas con hueco, respuesta, pista en inglés y ejemplo', () => {
    expect(flash.length).toBeGreaterThan(1000);
    for (const c of flash) {
      expect(c.prompt, c.id).toContain('____');
      expect(c.answer.trim(), c.id).not.toBe('');
      expect(c.hint, c.id).toBeTruthy();
      expect(c.explanation, c.id).toBeTruthy();
      expect(`${c.prompt} ${c.hint}`, c.id).not.toMatch(/[áíóúñ¿¡]/i);
    }
  });

  it('la pista nunca revela la palabra que falta', () => {
    const leaks = flash.filter((c) => c.answer.length > 3 && new RegExp(`\\b${c.answer}\\b`, 'i').test(c.hint ?? ''));
    expect(leaks.map((c) => c.id)).toEqual([]);
  });

  it('cubre todas las categorías C2', () => {
    const labels = new Set(flash.map((c) => categoryOf(byId.get(c.knowledgeId)!).label));
    for (const l of ['Idiom', 'Phrasal verb', 'Collocation', 'Fixed phrase', 'Structure', 'Pattern', 'Word formation']) expect(labels).toContain(l);
  });

  it('separa el frente y resalta el chunk del ejemplo', () => {
    const card = flash.find((c) => c.knowledgeId === 'lend-weight-to')!;
    expect(splitFront(card)).toEqual({ parts: ['lend ', ' to an argument'], answers: ['weight'] });
    expect(markedSegments('The data {{lend weight to}} it.')).toEqual([
      { text: 'The data ', mark: false }, { text: 'lend weight to', mark: true }, { text: ' it.', mark: false },
    ]);
  });
});

describe('cola estilo Anki', () => {
  it('sin historial: muestra nuevas hasta el límite diario', () => {
    const snap = deckSnapshot(lib(), DEFAULT_SETTINGS, today(), { now: NOW });
    expect(snap.counts).toEqual({ new: DEFAULT_SETTINGS.newPerDay, learning: 0, review: 0 });
    expect(snap.next?.type).toBe('flash');
  });

  it('las tarjetas en aprendizaje vencidas van primero', () => {
    const [a, b] = flash;
    const learning = state(a, { state: 1, due: new Date(NOW.getTime() - 60_000).toISOString(), scheduledDays: 0 });
    const review = state(b, { due: '2026-10-30T10:00:00Z' });
    const snap = deckSnapshot(lib([learning, review]), DEFAULT_SETTINGS, today(), { now: NOW });
    expect(snap.next?.id).toBe(a.id);
    expect(snap.counts.learning).toBe(1);
    expect(snap.counts.review).toBe(1);
  });

  it('no repite enseguida la tarjeta recién respondida si hay otra', () => {
    const [a, b] = flash;
    const s1 = state(a, { state: 1, due: new Date(NOW.getTime() - 1000).toISOString() });
    const s2 = state(b, { state: 1, due: new Date(NOW.getTime() - 500).toISOString() });
    const snap = deckSnapshot(lib([s1, s2]), DEFAULT_SETTINGS, today(), { now: NOW, lastCardId: a.id });
    expect(snap.next?.id).toBe(b.id);
  });

  it('cuando se termina lo del día, avisa y deja pedir más nuevas', () => {
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 0 };
    const snap = deckSnapshot(lib(), settings, today(), { now: NOW });
    expect(snap.next).toBeNull();
    expect(snap.unseen).toBe(flash.length);
    const more = deckSnapshot(lib(), settings, today(), { now: NOW, extraNew: 10 });
    expect(more.counts.new).toBe(10);
    expect(more.next).not.toBeNull();
  });

  it('respeta las nuevas ya estudiadas hoy', () => {
    const snap = deckSnapshot(lib(), DEFAULT_SETTINGS, today({ newDone: DEFAULT_SETTINGS.newPerDay - 3 }), { now: NOW });
    expect(snap.counts.new).toBe(3);
  });

  it('los repasos que vencen mañana no aparecen hoy', () => {
    const [a] = flash;
    const snap = deckSnapshot(lib([state(a, { due: '2026-11-03T10:00:00Z' })]), { ...DEFAULT_SETTINGS, newPerDay: 0 }, today(), { now: NOW });
    expect(snap.counts.review).toBe(0);
    expect(snap.next).toBeNull();
  });
});
