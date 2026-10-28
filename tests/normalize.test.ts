import { describe, expect, it } from 'vitest';
import { normalizeExpression, normalizeItem, parseCloze, validateCard } from '../src/lib/content/normalize.ts';

const ctx = { now: '2026-01-01T00:00:00.000Z', origin: 'import' as const, resolveSource: () => [] };

describe('normalizeItem', () => {
  it('genera tarjetas automáticas ES→EN y cloze a partir del ejemplo marcado', () => {
    const { knowledge, cards, issues } = normalizeItem({
      t: 'work like magic', es: 'funcionar de maravilla', qes: 'funcionó de maravilla', cat: ['idiom'], parts: ['P4'],
      ex: [['The new approach {{worked like magic}}.', 'El nuevo enfoque funcionó de maravilla.']],
    }, ctx);
    expect(knowledge.id).toBe('work-like-magic');
    expect(cards.map((c) => c.type).sort()).toEqual(['cloze', 'es2en']);
    const cloze = cards.find((c) => c.type === 'cloze')!;
    expect(cloze.prompt).toBe('The new approach ____.');
    expect(cloze.answer).toBe('worked like magic');
    expect(cards.find((c) => c.type === 'es2en')!.prompt).toBe('funcionó de maravilla');
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('acepta los nombres largos del formato documentado', () => {
    const { knowledge, cards } = normalizeItem({
      expression: 'talk someone out of + -ing', meaningEs: 'convencer de no hacer algo', categories: ['phrasal_verb'], examParts: ['P4'],
      cards: [{ type: 'kwt', original: 'She persuaded me not to resign.', keyword: 'out', prompt: 'She ____ resigning.', answer: 'talked me out of' }],
    }, ctx);
    expect(knowledge.categories).toEqual(['phrasal_verb']);
    const kwt = cards.find((c) => c.type === 'kwt')!;
    expect(kwt.keyword).toBe('OUT');
    expect(kwt.original).toContain('persuaded');
  });

  it('marca como pendiente lo no verificado y rechaza ítems sin significado', () => {
    expect(normalizeItem({ t: 'x', es: 'y', err: 'unverified' }, ctx).knowledge.validation).toBe('pending');
    expect(normalizeItem({ t: 'x' }, ctx).issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('desactiva las tarjetas automáticas en Word Formation', () => {
    const { cards } = normalizeItem({ t: 'educated', es: 'fundado', cat: ['word_formation'], cards: [{ k: 'wf', s: 'an ____ guess', root: 'educate', a: 'educated' }] }, ctx);
    expect(cards.map((c) => c.type)).toEqual(['wf']);
    expect(cards[0].root).toBe('EDUCATE');
  });
});

describe('validación de calidad', () => {
  const base = { id: 'x', knowledgeId: 'k', type: 'kwt' as const, prompt: 'She ____ resigning.', original: 'o', keyword: 'OUT', alternatives: [], origin: 'seed' as const, createdAt: '', updatedAt: '' };
  it('detecta KWT con contracciones, más de 8 palabras o sin la keyword', () => {
    expect(validateCard({ ...base, answer: "didn't talk me out of" }).some((i) => /contracci/.test(i.message))).toBe(true);
    expect(validateCard({ ...base, answer: 'convinced me not to go on with' }).some((i) => /keyword/.test(i.message))).toBe(true);
    expect(validateCard({ ...base, answer: 'one two three four five six seven eight out' }).some((i) => /palabras/.test(i.message))).toBe(true);
    expect(validateCard({ ...base, answer: 'talked me out of' })).toHaveLength(0);
  });

  it('avisa si el frente de un cloze ya contiene la respuesta', () => {
    const card = { ...base, type: 'cloze' as const, prompt: 'Take shape: the plan is ____.', answer: 'take shape' };
    expect(validateCard(card).length).toBeGreaterThan(0);
  });
});

describe('utilidades', () => {
  it('parseCloze soporta varios huecos', () => {
    const r = parseCloze('The boss {{tasked}} Ana {{with}} organising it.');
    expect(r.prompt).toBe('The boss ____ Ana ____ organising it.');
    expect(r.answers).toEqual(['tasked', 'with']);
  });
  it('normalizeExpression iguala variantes triviales', () => {
    expect(normalizeExpression('Talk someone out of')).toBe(normalizeExpression('talk sb out of'));
    expect(normalizeExpression('Work like magic.')).toBe('work like magic');
  });

  it('genera la flashcard desde el frente con {{palabra}}, la pista y el ejemplo', () => {
    const { cards, issues } = normalizeItem({
      t: 'lend weight to', f: 'lend {{weight}} to an argument', en: 'make it more convincing', cat: ['collocation'],
      ex: ['The data {{lend weight to}} the theory.'],
    }, ctx);
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(cards.map((c) => c.type)).toEqual(['flash']);
    expect(cards[0]).toMatchObject({ prompt: 'lend ____ to an argument', answer: 'weight', hint: 'make it more convincing', explanation: 'The data {{lend weight to}} the theory.' });
  });

  it('rechaza una flashcard que oculta un hueco libre de un ejercicio en vez de una palabra fija del chunk', () => {
    const { issues } = normalizeItem({
      t: 'have someone doing something', f: 'have the whole room {{laughing}}', en: 'cause a reaction', cat: ['verb_pattern'],
    }, ctx);
    expect(issues.some((i) => i.level === 'error' && /laughing/.test(i.message))).toBe(true);
    const ok = normalizeItem({ t: 'have someone doing something', f: '{{have}} someone doing something', en: 'cause a reaction', cat: ['verb_pattern'] }, ctx);
    expect(ok.issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
