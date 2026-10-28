// Práctica continua: dos modos (frases y word formation) que se alternan al azar, con FSRS por detrás.
// No hay calificación manual: la respuesta escrita se corrige sola y se registra como Again/Hard/Good.
import { BLANK } from './content/normalize';
import type { Grade } from './scheduler';
import type { Card, CardState, Knowledge } from './types';
import type { Library } from './queue';

export type PracticeMode = 'phrase' | 'wf';

export function modeOf(card: Card): PracticeMode | null {
  if (card.type === 'wf') return card.root ? 'wf' : null;
  if (card.type === 'cloze' || card.type === 'kwt') return 'phrase';
  return null;
}

/** Huecos y respuestas esperadas de una tarjeta («see … as» = dos huecos). */
export function splitGaps(card: Card): { parts: string[]; answers: string[][] } | null {
  const parts = card.prompt.split(BLANK);
  const gaps = parts.length - 1;
  if (gaps < 1) return null;
  const split = (a: string) => a.split(/\s*…\s*/);
  const main = split(card.answer);
  if (main.length !== gaps) return null;
  const answers = main.map((a) => [a]);
  for (const alt of card.alternatives) {
    const s = split(alt);
    if (s.length === gaps) s.forEach((a, i) => answers[i].push(a));
  }
  return { parts, answers };
}

export function isPracticeCard(card: Card, k: Knowledge | undefined): boolean {
  if (!k || card.suspended || card.deleted || k.status === 'archived') return false;
  if (k.categories.includes('strategy')) return false;
  return modeOf(card) !== null && splitGaps(card) !== null;
}

// ── Corrección ──
const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'cannot'], [/\bshan't\b/g, 'shall not'], [/n't\b/g, ' not'],
  [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'], [/\bi'm\b/g, 'i am'],
];

export function normalizeAnswer(text: string): string {
  let t = text.toLowerCase().normalize('NFKC').replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/\bcan not\b/g, 'cannot').replace(/[.,;:!?"«»()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export type GapResult = 'right' | 'close' | 'wrong';

export function checkGap(input: string, accepted: string[]): GapResult {
  const given = normalizeAnswer(input);
  if (!given) return 'wrong';
  const options = accepted.map(normalizeAnswer);
  if (options.includes(given)) return 'right';
  // Un error de tipeo en una palabra larga no es no saberla.
  if (options.some((o) => o.length >= 6 && distance(given, o) <= 1)) return 'close';
  return 'wrong';
}

export function gradeOf(results: GapResult[]): Grade {
  if (results.every((r) => r === 'right')) return 3;
  if (results.every((r) => r !== 'wrong')) return 2;
  return 1;
}

// ── Selección ──
export interface PracticeHistory {
  /** Últimas tarjetas mostradas (más reciente al final). */
  cards: string[];
  knowledge: string[];
  modes: PracticeMode[];
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Siguiente modo: a veces repite, a veces cambia; las rachas largas se cortan. */
export function pickMode(history: PracticeMode[], available: Record<PracticeMode, boolean>, rand = Math.random): PracticeMode {
  if (!available.wf) return 'phrase';
  if (!available.phrase) return 'wf';
  const last = history[history.length - 1];
  if (!last) return rand() < 0.65 ? 'phrase' : 'wf';
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i] === last; i--) streak++;
  const stay = last === 'phrase' ? (streak < 3 ? 0.62 : streak < 5 ? 0.35 : 0.1) : (streak < 2 ? 0.45 : streak < 3 ? 0.2 : 0.05);
  if (rand() < stay) return last;
  return last === 'phrase' ? 'wf' : 'phrase';
}

interface Candidate {
  card: Card;
  state?: CardState;
  k: Knowledge;
}

/**
 * Elige la próxima tarjeta de un modo: primero lo que está en aprendizaje y vencido, después repasos vencidos
 * (mezclados con alguna nueva para que no sea monótono), después nuevas y, si no queda nada, la que más se
 * está olvidando (práctica ilimitada).
 */
export function pickCard(lib: Library, mode: PracticeMode, history: PracticeHistory, now = new Date(), rand = Math.random): Card | null {
  const recentCards = new Set(history.cards.slice(-10));
  const recentKnowledge = new Set(history.knowledge.slice(-14));
  const t = now.getTime();
  const learning: Candidate[] = [];
  const due: Candidate[] = [];
  const fresh: Candidate[] = [];
  const ahead: Candidate[] = [];
  const fallback: Candidate[] = [];

  for (const card of lib.cards) {
    const k = lib.knowledge.get(card.knowledgeId);
    if (modeOf(card) !== mode || !isPracticeCard(card, k)) continue;
    const state = lib.states.get(card.id);
    const c = { card, state, k: k! };
    if (recentCards.has(card.id)) continue;
    fallback.push(c);
    if (recentKnowledge.has(k!.id)) continue;
    if (!state || state.state === 0) fresh.push(c);
    else if (new Date(state.due).getTime() > t) ahead.push(c);
    else if (state.state === 1 || state.state === 3) learning.push(c);
    else due.push(c);
  }

  const dueAt = (c: Candidate) => new Date(c.state!.due).getTime();
  if (learning.length) return learning.sort((a, b) => dueAt(a) - dueAt(b))[0].card;

  const byNew = (a: Candidate, b: Candidate) =>
    b.k.priority - a.k.priority || b.k.timesMissed - a.k.timesMissed || hash(a.card.id) - hash(b.card.id);
  // Lo vencido hace más tiempo (en proporción a su intervalo) se olvida antes.
  const overdue = (c: Candidate) => (t - dueAt(c)) / Math.max(1, c.state!.scheduledDays * 86_400_000) + c.k.priority * 0.05;

  if (due.length && (!fresh.length || rand() < 0.8)) return due.sort((a, b) => overdue(b) - overdue(a))[0].card;
  if (fresh.length) {
    // Entre las primeras nuevas, un poco de azar para no seguir siempre el mismo orden.
    const top = fresh.sort(byNew).slice(0, 12);
    return top[Math.floor(rand() * top.length)].card;
  }
  if (ahead.length) return ahead.sort((a, b) => dueAt(a) - dueAt(b))[0].card;
  if (fallback.length) return fallback[Math.floor(rand() * fallback.length)].card;
  return null;
}

export function availableModes(lib: Library): Record<PracticeMode, boolean> {
  const out: Record<PracticeMode, boolean> = { phrase: false, wf: false };
  for (const card of lib.cards) {
    const m = modeOf(card);
    if (m && !out[m] && isPracticeCard(card, lib.knowledge.get(card.knowledgeId))) out[m] = true;
  }
  return out;
}
