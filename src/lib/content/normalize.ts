// Normalización, validación y generación de tarjetas a partir de un «conocimiento».
// Lo usan el script del seed (Node con type stripping) y la importación dentro de la app,
// así que solo usa sintaxis TypeScript borrable y no depende del navegador.
import type {
  Card, CardType, Category, ErrorType, ExamPart, Example, FamilyMember, Knowledge, Origin, SourceRef,
} from '../types.ts';
import { CARD_TYPES, CATEGORIES, EXAM_PARTS } from '../types.ts';

export interface Issue {
  level: 'error' | 'warning';
  itemId: string;
  cardId?: string;
  message: string;
}

export interface NormalizeContext {
  now: string;
  origin: Origin;
  importBatchId?: string;
  /** Convierte una referencia cruda de fuente en una o más SourceRef normalizadas. */
  resolveSource: (raw: unknown) => SourceRef[];
  defaults?: Partial<RawItem>;
}

export interface NormalizedItem {
  knowledge: Knowledge;
  cards: Card[];
  issues: Issue[];
}

/** Forma «cruda» aceptada (alias cortos del autor y nombres largos documentados). */
export interface RawItem {
  [key: string]: unknown;
}

const CLOZE_RE = /\{\{(.+?)\}\}/g;
export const BLANK = '____';

export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Normaliza una expresión para detectar duplicados («Work like magic» ≈ «work like magic.»). */
export function normalizeExpression(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(sb|someone|somebody|sth|something|one's|ones|oneself|your|his|her|their)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pick(raw: RawItem, ...keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null) return raw[k];
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number') return String(v);
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) return v.map(asString).filter((s): s is string => !!s);
  return [];
}

function asExamples(v: unknown): Example[] {
  if (!Array.isArray(v)) return [];
  const out: Example[] = [];
  for (const e of v) {
    if (Array.isArray(e)) {
      const en = asString(e[0]);
      if (en) out.push({ en, es: asString(e[1]) });
    } else if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>;
      const en = asString(o.en ?? o.english ?? o.text);
      if (en) out.push({ en, es: asString(o.es ?? o.spanish ?? o.translation) });
    } else {
      const en = asString(e);
      if (en) out.push({ en });
    }
  }
  return out;
}

function asFamily(v: unknown): FamilyMember[] {
  if (!Array.isArray(v)) return [];
  const out: FamilyMember[] = [];
  for (const f of v) {
    if (Array.isArray(f)) {
      const word = asString(f[0]);
      if (word) out.push({ word, pos: asString(f[1]) ?? '', gloss: asString(f[2]) });
    } else if (f && typeof f === 'object') {
      const o = f as Record<string, unknown>;
      const word = asString(o.word);
      if (word) out.push({ word, pos: asString(o.pos ?? o.category) ?? '', gloss: asString(o.gloss ?? o.es) });
    }
  }
  return out;
}

function clampPriority(v: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  const n = typeof v === 'number' ? v : Number(v);
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return fallback;
}

const ERROR_TYPES: ErrorType[] = ['error', 'alt', 'register', 'unverified'];
const CARD_TYPE_ALIASES: Record<string, CardType> = {
  es2en: 'es2en', recall: 'es2en', translation_recall: 'es2en',
  cloze: 'cloze', gap: 'cloze',
  contrast: 'contrast', confusable: 'contrast', distinction: 'contrast',
  kwt: 'kwt', key_word_transformation: 'kwt', transformation: 'kwt',
  wf: 'wf', word_formation: 'wf',
  pattern: 'pattern', grammar: 'pattern', rule: 'pattern',
  prod: 'prod', production: 'prod', translate: 'prod',
  fix: 'fix', correction: 'fix', error_fix: 'fix',
  flash: 'flash', flashcard: 'flash',
};

/** Extrae los huecos {{…}} de una oración. */
export function parseCloze(sentence: string): { prompt: string; answers: string[]; full: string } {
  const answers: string[] = [];
  const prompt = sentence.replace(CLOZE_RE, (_m, inner: string) => {
    answers.push(inner.trim());
    return BLANK;
  });
  const full = sentence.replace(CLOZE_RE, (_m, inner: string) => inner);
  return { prompt, answers, full };
}

export function stripCloze(sentence: string): string {
  return sentence.replace(CLOZE_RE, (_m, inner: string) => inner);
}

const CONTRACTION_RE = /\b\w+(n't|'ll|'re|'ve|'d|'m)\b|\b(it|that|there|he|she|what|who|here)'s\b/i;

function countWords(text: string): number {
  return text.replace(/[,.;:!?]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function containsWord(haystack: string, needle: string): boolean {
  const esc = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!esc) return false;
  return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu').test(haystack);
}

/** Palabras significativas de la respuesta que aparecen ya en el frente (posible pista involuntaria). */
function revealedWords(front: string, answer: string): string[] {
  const stop = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'is', 'be', 'it', 'that', 'with', 'by', 'as', 'not', 'was', 'were', 'has', 'have', 'had', 'did', 'does', 'do', 'will', 'can', 'one', 'some', 'there', 'this', 'than', 'from', 'into', 'out', 'up', 'down', 'off', 'about', 'very', 'all', 'no', 'more', 'what', 'how', 'who', 'which', 'only', 'just', 'so', 'such', 'its', 'their', 'his', 'her', 'my', 'your', 'our', 'me', 'him', 'them', 'us', 'we', 'they', 'she', 'he', 'you', 'i']);
  const words = answer.toLowerCase().replace(/[^a-z' -]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !stop.has(w));
  return words.filter((w) => containsWord(front, w));
}

export function normalizeItem(rawInput: RawItem, ctx: NormalizeContext): NormalizedItem {
  const raw: RawItem = { ...(ctx.defaults ?? {}), ...rawInput };
  if (ctx.defaults?.tags && rawInput.tags) {
    raw.tags = [...asStringArray(ctx.defaults.tags), ...asStringArray(rawInput.tags)];
  }
  const issues: Issue[] = [];
  const expression = asString(pick(raw, 't', 'expression', 'term', 'english')) ?? '';
  const id = asString(pick(raw, 'id', 'key')) ?? slugify(expression);
  const meaningEs = asString(pick(raw, 'es', 'meaningEs', 'meaning', 'spanish')) ?? '';
  const meaningEn = asString(pick(raw, 'en', 'meaningEn', 'cue'));
  /** Frente de la flashcard: el chunk con {{la palabra que falta}}. */
  const flashFront = asString(pick(raw, 'f', 'front', 'flash'));
  if (!expression) issues.push({ level: 'error', itemId: id, message: 'Falta la expresión (t / expression).' });
  if (!meaningEs && !meaningEn) issues.push({ level: 'error', itemId: id, message: 'Falta el significado (en / es).' });
  if (flashFront && !/\{\{.+?\}\}/.test(flashFront)) issues.push({ level: 'error', itemId: id, message: `El frente «${flashFront}» no marca la palabra que falta con {{…}}.` });
  if (flashFront && !meaningEn) issues.push({ level: 'warning', itemId: id, message: 'Flashcard sin pista en inglés (en).' });

  const rawCats = asStringArray(pick(raw, 'cat', 'categories', 'category'));
  const categories = rawCats.filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  for (const c of rawCats) {
    if (!(CATEGORIES as readonly string[]).includes(c)) issues.push({ level: 'warning', itemId: id, message: `Categoría desconocida «${c}» (se ignora).` });
  }
  if (!categories.length) categories.push('expression');

  const rawParts = asStringArray(pick(raw, 'parts', 'examParts', 'part'));
  const examParts = rawParts.map((p) => p.toUpperCase()).filter((p): p is ExamPart => (EXAM_PARTS as readonly string[]).includes(p));
  if (!examParts.length) examParts.push('GEN');

  const errRaw = asString(pick(raw, 'err', 'errorType'));
  const errorType = errRaw && (ERROR_TYPES as string[]).includes(errRaw) ? (errRaw as ErrorType) : undefined;
  const timesMissed = Math.max(0, Number(pick(raw, 'miss', 'timesMissed') ?? 0) || 0);
  const sources: SourceRef[] = [];
  const rawSources = pick(raw, 'src', 'sources', 'source');
  for (const s of Array.isArray(rawSources) && (rawSources.length === 0 || typeof rawSources[0] !== 'string' || Array.isArray(rawSources[0])) ? rawSources : rawSources ? [rawSources] : []) {
    sources.push(...ctx.resolveSource(s));
  }
  const validationRaw = asString(pick(raw, 'val', 'validation'));
  const validation = validationRaw === 'pending' || errorType === 'unverified' ? 'pending' : 'validated';
  const examples = asExamples(pick(raw, 'ex', 'examples'));
  const notes = asString(pick(raw, 'note', 'notes', 'rule'));

  const knowledge: Knowledge = {
    id,
    expression,
    meaningEs,
    meaningEn,
    promptEs: asString(pick(raw, 'qes', 'promptEs')),
    hint: asString(pick(raw, 'h', 'hint')),
    categories: Array.from(new Set(categories)),
    examParts: Array.from(new Set(examParts)),
    pattern: asString(pick(raw, 'pat', 'pattern', 'structure')),
    examples,
    aliases: asStringArray(pick(raw, 'aka', 'aliases', 'variants')),
    wrongAnswers: asStringArray(pick(raw, 'wrong', 'wrongAnswers', 'mistakes')),
    notes,
    confusables: asStringArray(pick(raw, 'conf', 'confusables', 'contrasts')),
    family: asFamily(pick(raw, 'fam', 'family', 'wordFamily')),
    root: asString(pick(raw, 'root')),
    tags: Array.from(new Set(asStringArray(pick(raw, 'tags')))),
    sources,
    timesSeen: Math.max(1, Number(pick(raw, 'seen', 'timesSeen') ?? 0) || sources.length || 1),
    timesMissed,
    priority: clampPriority(pick(raw, 'prio', 'priority'), timesMissed >= 2 ? 3 : timesMissed === 1 ? 2 : 1),
    errorType,
    validation,
    origin: ctx.origin,
    importBatchId: ctx.importBatchId,
    status: 'active',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };

  const cards: Card[] = [];
  const noauto = new Set(asStringArray(pick(raw, 'noauto')));
  const forceAuto = pick(raw, 'auto') === true;
  const autoDisabledByCategory = categories.includes('word_formation') || categories.includes('strategy');
  // Un «X vs Y» se practica mejor con su tarjeta de contraste que con «¿Cómo se dice…?».
  const isContrastEntry = / vs\.? /i.test(expression);
  // Los ítems nuevos (solo flashcard, sin español) no generan las tarjetas automáticas antiguas.
  const flashOnly = !!flashFront && !meaningEs;
  const autoAllowed = (type: 'es2en' | 'cloze') =>
    !flashOnly && (forceAuto || (!noauto.has(type) && !autoDisabledByCategory && !(type === 'es2en' && isContrastEntry)));
  const base = { knowledgeId: id, alternatives: [] as string[], origin: ctx.origin, createdAt: ctx.now, updatedAt: ctx.now };

  if (autoAllowed('es2en')) {
    cards.push({
      ...base,
      id: `${id}:es2en:auto`,
      type: 'es2en',
      prompt: knowledge.promptEs ?? meaningEs,
      hint: knowledge.hint,
      answer: expression,
      alternatives: knowledge.aliases.slice(0, 4),
    });
  }
  // Un cloze por cada ejemplo marcado (el primero conserva su id histórico «:cloze:auto»).
  const clozeSources = examples.filter((e) => /\{\{.+?\}\}/.test(e.en));
  if (autoAllowed('cloze')) {
    clozeSources.forEach((src, i) => {
      const { prompt, answers, full } = parseCloze(src.en);
      cards.push({
        ...base,
        id: i === 0 ? `${id}:cloze:auto` : `${id}:cloze:auto${i + 1}`,
        type: 'cloze',
        prompt,
        hint: src.es,
        answer: answers.join(' … '),
        translation: src.es,
        explanation: full,
      });
    });
  }
  // Word Formation: cada ejemplo con un único hueco de una palabra se practica también con la raíz.
  if (!flashOnly && categories.includes('word_formation') && knowledge.root && !noauto.has('wf')) {
    clozeSources.forEach((src, i) => {
      const { prompt, answers, full } = parseCloze(src.en);
      if (answers.length !== 1 || /\s/.test(answers[0])) return;
      cards.push({
        ...base,
        id: `${id}:wf:ex${i + 1}`,
        type: 'wf',
        prompt,
        root: knowledge.root!.toUpperCase(),
        answer: answers[0],
        explanation: full,
      });
    });
  }

  const rawCards = pick(raw, 'cards');
  const counters: Record<string, number> = {};
  if (Array.isArray(rawCards)) {
    for (const rc of rawCards) {
      if (!rc || typeof rc !== 'object') continue;
      const c = rc as Record<string, unknown>;
      const typeRaw = (asString(c.k ?? c.type) ?? '').toLowerCase();
      const type = CARD_TYPE_ALIASES[typeRaw];
      if (!type) {
        issues.push({ level: 'warning', itemId: id, message: `Tipo de tarjeta desconocido «${typeRaw}».` });
        continue;
      }
      counters[type] = (counters[type] ?? 0) + 1;
      const cardId = asString(c.id) ?? `${id}:${type}:${counters[type]}`;
      let prompt = asString(c.q ?? c.prompt ?? c.s ?? c.stem) ?? '';
      let answer = asString(c.a ?? c.answer) ?? '';
      const explanation = asString(c.x ?? c.explanation);
      if (type === 'cloze' && !answer && CLOZE_RE.test(prompt)) {
        CLOZE_RE.lastIndex = 0;
        const parsed = parseCloze(prompt);
        prompt = parsed.prompt;
        answer = parsed.answers.join(' … ');
      }
      CLOZE_RE.lastIndex = 0;
      if (type === 'es2en' && !prompt) prompt = knowledge.promptEs ?? meaningEs;
      if (type === 'es2en' && !answer) answer = expression;
      if (!prompt || !answer) {
        issues.push({ level: 'error', itemId: id, cardId, message: 'Tarjeta sin pregunta o sin respuesta.' });
        continue;
      }
      cards.push({
        ...base,
        id: cardId,
        type,
        prompt,
        hint: asString(c.h ?? c.hint ?? (type === 'cloze' ? c.tr : undefined)),
        original: asString(c.o ?? c.original),
        keyword: asString(c.kw ?? c.keyword)?.toUpperCase(),
        root: asString(c.root)?.toUpperCase(),
        pos: asString(c.pos),
        answer,
        alternatives: asStringArray(c.alts ?? c.alternatives),
        explanation,
        translation: asString(c.tr ?? c.translation),
      });
    }
  }

  if (flashFront) {
    const { prompt, answers } = parseCloze(flashFront);
    // Reverso: la primera oración de ejemplo (con el chunk marcado) o, si no hay, la de una tarjeta del ítem.
    const filled = cards.find((c) => c.prompt.includes(BLANK) && !c.answer.includes('…'));
    const example = examples[0]?.en ?? (filled ? filled.prompt.replace(BLANK, `{{${filled.answer}}}`) : undefined);
    cards.push({
      ...base,
      id: `${id}:flash`,
      type: 'flash',
      prompt,
      answer: answers.join(' … '),
      hint: meaningEn,
      root: categories.includes('word_formation') ? knowledge.root?.toUpperCase() : undefined,
      explanation: example,
    });
  }

  if (!cards.length) {
    issues.push({ level: 'warning', itemId: id, message: 'El conocimiento no generó ninguna tarjeta.' });
  }
  for (const card of cards) issues.push(...validateCard(card));
  return { knowledge, cards, issues };
}

export function validateCard(card: Card): Issue[] {
  const issues: Issue[] = [];
  const push = (level: Issue['level'], message: string) => issues.push({ level, itemId: card.knowledgeId, cardId: card.id, message });
  if (card.type === 'kwt') {
    if (!card.keyword) push('error', 'KWT sin keyword.');
    if (!card.original) push('error', 'KWT sin oración original.');
    if (!card.prompt.includes(BLANK)) push('warning', 'KWT: la oración a completar no tiene hueco «____».');
    for (const ans of [card.answer, ...card.alternatives]) {
      const n = countWords(ans);
      if (n < 2 || n > 8) push('warning', `KWT: «${ans}» tiene ${n} palabras (el examen exige 3–8 incluyendo la keyword).`);
      if (card.keyword && !containsWord(ans, card.keyword)) push('warning', `KWT: «${ans}» no contiene la keyword ${card.keyword}.`);
      if (CONTRACTION_RE.test(ans)) push('warning', `KWT: «${ans}» usa una contracción (en el examen no se permiten).`);
    }
  }
  if (card.type === 'wf' && !card.root) push('error', 'Word Formation sin raíz.');
  if ((card.type === 'cloze' || card.type === 'wf' || card.type === 'kwt') && !card.prompt.includes(BLANK)) {
    push('warning', 'La pregunta no contiene el hueco «____».');
  }
  if (card.type === 'flash') {
    if (!card.prompt.includes(BLANK)) push('error', 'Flashcard sin hueco «____».');
    const words = card.answer.split(/\s*…\s*|\s+/).filter((w) => w.length > 3);
    const inCue = words.filter((w) => card.hint && containsWord(card.hint, w));
    if (inCue.length) push('warning', `La pista en inglés revela la respuesta: ${inCue.join(', ')}.`);
  }
  if (card.type === 'cloze' || card.type === 'kwt' || card.type === 'wf' || card.type === 'flash') {
    const leaked = card.answer.split(/\s*…\s*/).filter((a) => a.length > 3 && containsWord(card.prompt.replace(BLANK, ' '), a));
    if (leaked.length) push('warning', `La respuesta «${leaked.join(', ')}» ya aparece en el frente.`);
  }
  if (card.type === 'es2en') {
    // La pista (p. ej. la keyword) se muestra solo a pedido; se controla únicamente el frente visible.
    const leaked = revealedWords(card.prompt, card.answer);
    if (leaked.length) push('warning', `El frente en español contiene palabras de la respuesta: ${leaked.join(', ')}.`);
  }
  return issues;
}

export function isCardType(v: string): v is CardType {
  return (CARD_TYPES as readonly string[]).includes(v);
}
