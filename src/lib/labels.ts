import type { CardType, Category, ErrorType, ExamPart } from './types';
import type { Tone } from '../components/ui';

export const PART_LABELS: Record<ExamPart, { short: string; long: string }> = {
  P1: { short: 'MC Cloze', long: 'Part 1 · Multiple Choice Cloze' },
  P2: { short: 'Open Cloze', long: 'Part 2 · Open Cloze' },
  P3: { short: 'Word Formation', long: 'Part 3 · Word Formation' },
  P4: { short: 'KWT', long: 'Part 4 · Key Word Transformation' },
  P5: { short: 'Reading P5', long: 'Part 5 · Multiple Choice (Reading)' },
  P6: { short: 'Gapped Text', long: 'Part 6 · Gapped Text' },
  P7: { short: 'Multiple Matching', long: 'Part 7 · Multiple Matching' },
  LIS: { short: 'Listening', long: 'Listening' },
  WRI: { short: 'Writing', long: 'Writing' },
  SPK: { short: 'Speaking', long: 'Speaking' },
  GEN: { short: 'General', long: 'General' },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  chunk: 'Chunk',
  collocation: 'Collocation',
  phrasal_verb: 'Phrasal verb',
  idiom: 'Idiom',
  fixed_phrase: 'Fixed phrase',
  expression: 'Expresión',
  vocabulary: 'Vocabulario avanzado',
  lexical_distinction: 'Distinción léxica',
  false_friend: 'Falso amigo',
  prepositional_phrase: 'Frase preposicional',
  linking: 'Conector',
  academic: 'Académico',
  british: 'Inglés británico',
  grammar_pattern: 'Patrón gramatical',
  verb_pattern: 'Verb pattern',
  inversion: 'Inversión',
  conditional: 'Condicional',
  cleft: 'Cleft sentence',
  emphasis: 'Énfasis',
  passive: 'Pasiva',
  causative: 'Causativa',
  relative_clause: 'Relativo',
  comparative: 'Comparación',
  reporting: 'Reporting',
  tense: 'Tiempos verbales',
  agreement: 'Concordancia',
  possessive: 'Posesivo',
  word_formation: 'Word Formation',
  spelling: 'Ortografía',
  strategy: 'Estrategia de examen',
};

export const CARD_TYPE_LABELS: Record<CardType, { label: string; instruction: string; tone: Tone }> = {
  es2en: { label: 'Recuperación', instruction: '¿Cómo se dice en inglés…?', tone: 'lavender' },
  cloze: { label: 'Completá', instruction: 'Completá el hueco', tone: 'sky' },
  contrast: { label: 'Contraste', instruction: 'Distinguí las expresiones', tone: 'amber' },
  kwt: { label: 'Key Word Transformation', instruction: 'Completá con 3–8 palabras usando la keyword sin cambiarla', tone: 'primary' },
  wf: { label: 'Word Formation', instruction: 'Formá la palabra correcta a partir de la raíz', tone: 'sage' },
  pattern: { label: 'Patrón', instruction: 'Recordá la regla o estructura', tone: 'lavender' },
  prod: { label: 'Producción activa', instruction: 'Traducí al inglés', tone: 'coral' },
  fix: { label: 'Corregí el error', instruction: 'Encontrá y corregí el error', tone: 'coral' },
};

export const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; tone: Tone; description: string }> = {
  error: { label: 'Error real', tone: 'coral', description: 'Respuesta lingüísticamente incorrecta.' },
  alt: { label: 'Alternativa válida', tone: 'sage', description: 'Tu respuesta era correcta; la rechazó un autocorrector limitado.' },
  register: { label: 'Variante de registro', tone: 'amber', description: 'Correcta, pero más formal o menos habitual.' },
  unverified: { label: 'No verificado', tone: 'neutral', description: 'No hay información suficiente para decidir; queda pendiente de validación.' },
};

export const STATE_LABELS = ['Nueva', 'Aprendiendo', 'Repaso', 'Reaprendiendo'] as const;
