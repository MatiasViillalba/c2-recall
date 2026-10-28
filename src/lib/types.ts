// Modelo de datos de C2 Recall. Solo contiene tipos y listas constantes (sin dependencias),
// así lo pueden importar tanto la app (Vite) como los scripts de Node con type stripping.

export const EXAM_PARTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'LIS', 'WRI', 'SPK', 'GEN'] as const;
export type ExamPart = (typeof EXAM_PARTS)[number];

export const CATEGORIES = [
  'chunk', 'collocation', 'phrasal_verb', 'idiom', 'fixed_phrase', 'expression', 'vocabulary',
  'lexical_distinction', 'false_friend', 'prepositional_phrase', 'linking', 'academic', 'british',
  'grammar_pattern', 'verb_pattern', 'inversion', 'conditional', 'cleft', 'emphasis', 'passive',
  'causative', 'relative_clause', 'comparative', 'reporting', 'tense', 'agreement', 'possessive',
  'word_formation', 'spelling', 'strategy',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CARD_TYPES = ['es2en', 'cloze', 'contrast', 'kwt', 'wf', 'pattern', 'prod', 'fix', 'flash'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** error = error real · alt = alternativa válida rechazada por un autocorrector · register = variante de registro · unverified = no verificado */
export type ErrorType = 'error' | 'alt' | 'register' | 'unverified';
export type Validation = 'validated' | 'pending';
export type Origin = 'seed' | 'import' | 'manual';

export interface Source {
  id: string;
  title: string;
  kind: 'pdf' | 'mock' | 'exercise' | 'class' | 'reading' | 'listening' | 'other';
  pages?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface SourceRef {
  sourceId: string;
  page?: number;
  exercise?: string;
}

export interface Example {
  /** Puede contener marcas {{…}} para generar huecos de cloze. */
  en: string;
  es?: string;
}

export interface FamilyMember {
  word: string;
  pos: string;
  gloss?: string;
}

export interface Knowledge {
  id: string;
  expression: string;
  meaningEs: string;
  /** Pista breve en inglés que acompaña a la flashcard. */
  meaningEn?: string;
  /** Texto en español para la tarjeta «¿Cómo se dice…?» si difiere de meaningEs. */
  promptEs?: string;
  hint?: string;
  categories: Category[];
  examParts: ExamPart[];
  pattern?: string;
  examples: Example[];
  aliases: string[];
  wrongAnswers: string[];
  notes?: string;
  confusables: string[];
  family: FamilyMember[];
  root?: string;
  tags: string[];
  sources: SourceRef[];
  timesSeen: number;
  timesMissed: number;
  priority: 1 | 2 | 3;
  errorType?: ErrorType;
  validation: Validation;
  origin: Origin;
  importBatchId?: string;
  favorite?: boolean;
  status: 'active' | 'archived' | 'mastered';
  markedDifficult?: boolean;
  /** El usuario editó el contenido: una actualización del seed ya no lo pisa. */
  userEdited?: boolean;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Card {
  id: string;
  knowledgeId: string;
  type: CardType;
  prompt: string;
  /** Pista opcional (traducción del ejemplo, keyword, etc.). */
  hint?: string;
  original?: string;
  keyword?: string;
  root?: string;
  pos?: string;
  answer: string;
  alternatives: string[];
  explanation?: string;
  /** Traducción al español de la respuesta/oración completa, si aplica. */
  translation?: string;
  origin: Origin;
  suspended?: boolean;
  flagged?: { reason: string; at: string };
  userEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

/** Estado FSRS derivado (caché). Se puede reconstruir siempre a partir de los ReviewEvent. */
export interface CardState {
  cardId: string;
  knowledgeId: string;
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  /** 0 New · 1 Learning · 2 Review · 3 Relearning */
  state: 0 | 1 | 2 | 3;
  lastReview?: string;
  /** Fecha del primer repaso (para contar tarjetas nuevas por día). */
  firstReview?: string;
}

export type ReviewKind = 'review' | 'reset' | 'cram' | 'external';

export interface ReviewEvent {
  id: string;
  cardId: string;
  knowledgeId: string;
  /** 1 Again · 2 Hard · 3 Good · 4 Easy · 0 = reset manual */
  rating: 0 | 1 | 2 | 3 | 4;
  kind: ReviewKind;
  reviewedAt: string;
  durationMs: number;
  deviceId: string;
  /** Instantánea informativa (para estadísticas); la programación se recalcula reproduciendo eventos. */
  stateBefore?: number;
  scheduledDaysAfter?: number;
  dueAfter?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorLog {
  id: string;
  knowledgeId: string;
  occurredAt: string;
  wrongAnswer?: string;
  sourceTitle?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface DeckFilter {
  parts?: ExamPart[];
  categories?: Category[];
  tags?: string[];
  sourceIds?: string[];
  knowledgeIds?: string[];
  cardTypes?: CardType[];
  errorsOnly?: boolean;
  favoritesOnly?: boolean;
  difficultOnly?: boolean;
  /** Cualquier filtro (OR) vs todos (AND) entre parts/categories/tags. */
  match?: 'any' | 'all';
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  filter: DeckFilter;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface ImportBatch {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  via: 'file' | 'paste' | 'inbox' | 'seed';
  sourceTitle?: string;
  added: number;
  updated: number;
  recurrences: number;
  skipped: number;
  cardsAdded: number;
  deleted?: boolean;
}

export interface Settings {
  id: 'settings';
  newPerDay: number;
  reviewsPerDay: number;
  retention: number;
  maximumInterval: number;
  learningSteps: string[];
  relearningSteps: string[];
  enableFuzz: boolean;
  dayStartsAtHour: number;
  theme: 'system' | 'light' | 'dark';
  autoSpeak: boolean;
  voiceURI?: string;
  speechRate: number;
  showHintsByDefault: boolean;
  dailyGoalMinutes: number;
  examDate?: string;
  displayName?: string;
  leechThreshold: number;
  updatedAt: string;
}

export type SyncedTable = 'knowledge' | 'cards' | 'decks' | 'settings' | 'sources' | 'errorLogs' | 'importBatches' | 'reviews';

export interface OutboxEntry {
  key: string; // `${table}:${id}`
  table: SyncedTable;
  id: string;
  queuedAt: string;
}
