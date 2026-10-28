import { describe, expect, it } from 'vitest';
import { applyRating, DEFAULT_SETTINGS, makeScheduler, newCardState, previewIntervals, replay } from '../src/lib/scheduler';
import type { ReviewEvent } from '../src/lib/types';

const f = makeScheduler(DEFAULT_SETTINGS);
const ev = (id: string, rating: 0 | 1 | 2 | 3 | 4, at: string, kind: ReviewEvent['kind'] = 'review'): ReviewEvent => ({
  id, cardId: 'c', knowledgeId: 'k', rating, kind, reviewedAt: at, durationMs: 1000, deviceId: 'd', createdAt: at, updatedAt: at,
});

describe('FSRS', () => {
  it('una tarjeta nueva calificada Good pasa a aprendizaje y vuelve en minutos', () => {
    const s = applyRating(newCardState('c', 'k'), 3, new Date('2026-01-01T10:00:00Z'), f);
    expect(s.state).toBe(1);
    expect(new Date(s.due).getTime() - new Date('2026-01-01T10:00:00Z').getTime()).toBeLessThanOrEqual(10 * 60_000);
  });

  it('los intervalos crecen con repasos exitosos y un Again provoca un lapse', () => {
    let s = newCardState('c', 'k');
    let t = new Date('2026-01-01T10:00:00Z');
    for (let i = 0; i < 4; i++) {
      s = applyRating(s, 3, t, f);
      t = new Date(s.due);
    }
    expect(s.state).toBe(2);
    const interval = s.scheduledDays;
    const again = applyRating(s, 1, t, f);
    expect(again.lapses).toBe(1);
    expect(again.state).toBe(3);
    const good = applyRating(s, 3, t, f);
    expect(good.scheduledDays).toBeGreaterThan(interval);
  });

  it('reproducir el historial es determinista e independiente del orden de llegada (sync)', () => {
    const events = [ev('a', 3, '2026-01-01T10:00:00Z'), ev('b', 3, '2026-01-01T10:10:00Z'), ev('c', 4, '2026-01-03T09:00:00Z'), ev('d', 1, '2026-01-20T09:00:00Z')];
    const s1 = replay('c', 'k', events, f);
    const s2 = replay('c', 'k', [...events].reverse(), f);
    expect(s2).toEqual(s1);
    expect(s1.reps).toBe(4);
    expect(s1.lapses).toBe(1);
  });

  it('ignora repasos borrados (deshacer) y los de repaso intensivo', () => {
    const base = [ev('a', 3, '2026-01-01T10:00:00Z'), ev('b', 3, '2026-01-01T10:10:00Z')];
    const withCram = [...base, ev('x', 1, '2026-01-01T11:00:00Z', 'cram'), { ...ev('y', 1, '2026-01-01T12:00:00Z'), deleted: true }];
    expect(replay('c', 'k', withCram, f)).toEqual(replay('c', 'k', base, f));
  });

  it('un reset vuelve la tarjeta a nueva sin borrar eventos', () => {
    const s = replay('c', 'k', [ev('a', 3, '2026-01-01T10:00:00Z'), ev('r', 0, '2026-01-02T10:00:00Z', 'reset')], f);
    expect(s.state).toBe(0);
    expect(s.reps).toBe(0);
  });

  it('la retención objetivo cambia los intervalos', () => {
    const strict = makeScheduler({ ...DEFAULT_SETTINGS, retention: 0.95, enableFuzz: false });
    const relaxed = makeScheduler({ ...DEFAULT_SETTINGS, retention: 0.82, enableFuzz: false });
    let a = newCardState('c', 'k');
    let b = newCardState('c', 'k');
    let t = new Date('2026-01-01T10:00:00Z');
    for (let i = 0; i < 4; i++) {
      a = applyRating(a, 3, t, strict);
      b = applyRating(b, 3, t, relaxed);
      t = new Date(Math.max(new Date(a.due).getTime(), new Date(b.due).getTime()));
    }
    expect(b.scheduledDays).toBeGreaterThan(a.scheduledDays);
  });

  it('previewIntervals devuelve 4 opciones ordenadas', () => {
    const p = previewIntervals(newCardState('c', 'k'), new Date('2026-01-01T10:00:00Z'), f);
    expect(p.map((x) => x.rating)).toEqual([1, 2, 3, 4]);
    expect(p[3].due.getTime()).toBeGreaterThan(p[0].due.getTime());
  });
});
