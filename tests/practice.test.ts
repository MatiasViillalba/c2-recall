import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkGap, gradeOf, isPracticeCard, modeOf, pickCard, pickMode, splitGaps, type PracticeHistory, type PracticeMode } from '../src/lib/practice';
import type { Library } from '../src/lib/queue';
import type { Card, CardState, Knowledge } from '../src/lib/types';

const seed = JSON.parse(readFileSync('public/seed/seed.json', 'utf8')) as { knowledge: Knowledge[]; cards: Card[] };
const lib = (states: CardState[] = []): Library => ({
  knowledge: new Map(seed.knowledge.map((k) => [k.id, k])),
  cards: seed.cards,
  states: new Map(states.map((s) => [s.cardId, s])),
});
const empty = (): PracticeHistory => ({ cards: [], knowledge: [], modes: [] });

describe('corrección automática', () => {
  it('acepta mayúsculas, espacios, comillas tipográficas y contracciones', () => {
    expect(checkGap('  every NOW and again ', ['Every now and again'])).toBe('right');
    expect(checkGap('didn’t use to', ['did not use to'])).toBe('right');
    expect(checkGap('won\'t', ['will not'])).toBe('right');
  });
  it('un error de tipeo en una palabra larga cuenta como «casi»', () => {
    expect(checkGap('fearlesness', ['fearlessness'])).toBe('close');
    expect(checkGap('fearless', ['fearlessness'])).toBe('wrong');
    expect(checkGap('', ['at'])).toBe('wrong');
  });
  it('la nota sale sola: todo bien = Good, casi = Hard, algún error = Again', () => {
    expect(gradeOf(['right', 'right'])).toBe(3);
    expect(gradeOf(['right', 'close'])).toBe(2);
    expect(gradeOf(['right', 'wrong'])).toBe(1);
  });
});

describe('tarjetas de práctica', () => {
  it('solo hay dos modos: frases (cloze + KWT) y word formation', () => {
    const practice = seed.cards.filter((c) => isPracticeCard(c, seed.knowledge.find((k) => k.id === c.knowledgeId)));
    const modes = new Set(practice.map(modeOf));
    expect([...modes].sort()).toEqual(['phrase', 'wf']);
    expect(practice.filter((c) => modeOf(c) === 'wf').length).toBeGreaterThan(150);
    expect(practice.every((c) => !['es2en', 'contrast', 'pattern', 'prod', 'fix'].includes(c.type))).toBe(true);
  });
  it('separa los huecos de un collocation partido («see … as»)', () => {
    const card = seed.cards.find((c) => c.answer === 'see … as')!;
    const gaps = splitGaps(card)!;
    expect(gaps.answers.map((a) => a[0])).toEqual(['see', 'as']);
    expect(gaps.parts).toHaveLength(3);
  });
});

describe('alternancia y repetición espaciada', () => {
  it('alterna modos sin rachas interminables', () => {
    let seedN = 7;
    const rand = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
    const modes: PracticeMode[] = [];
    for (let i = 0; i < 400; i++) modes.push(pickMode(modes, { phrase: true, wf: true }, rand));
    const wf = modes.filter((m) => m === 'wf').length;
    expect(wf).toBeGreaterThan(80);
    expect(wf).toBeLessThan(220);
    let longest = 0;
    let run = 0;
    modes.forEach((m, i) => { run = i && modes[i - 1] === m ? run + 1 : 1; longest = Math.max(longest, run); });
    expect(longest).toBeLessThan(12);
  });

  it('prioriza lo vencido y nunca repite una tarjeta reciente', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const target = seed.cards.find((c) => c.type === 'wf')!;
    const dueState: CardState = {
      cardId: target.id, knowledgeId: target.knowledgeId, due: '2026-10-30T12:00:00Z', stability: 3, difficulty: 5,
      scheduledDays: 3, learningSteps: 0, reps: 2, lapses: 0, state: 2, lastReview: '2026-10-27T12:00:00Z',
    };
    const l = lib([dueState]);
    expect(pickCard(l, 'wf', empty(), now, () => 0.1)!.id).toBe(target.id);
    const h = { ...empty(), cards: [target.id], knowledge: [target.knowledgeId] };
    expect(pickCard(l, 'wf', h, now, () => 0.1)!.id).not.toBe(target.id);
  });

  it('es ilimitada: si todo está al día, sigue con lo que vence antes', () => {
    const wfCards = seed.cards.filter((c) => modeOf(c) === 'wf');
    const states: CardState[] = wfCards.map((c, i) => ({
      cardId: c.id, knowledgeId: c.knowledgeId, due: new Date(Date.UTC(2027, 0, 1 + i)).toISOString(), stability: 30, difficulty: 5,
      scheduledDays: 30, learningSteps: 0, reps: 3, lapses: 0, state: 2, lastReview: '2026-10-01T00:00:00Z',
    }));
    const pick = pickCard(lib(states), 'wf', empty(), new Date('2026-11-01T00:00:00Z'));
    expect(pick?.id).toBe(wfCards[0].id);
  });
});
