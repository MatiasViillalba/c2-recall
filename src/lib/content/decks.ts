// Mazos predefinidos. Son filtros: una misma tarjeta puede pertenecer a varios mazos sin duplicarse.
import type { Deck } from '../types.ts';

type BuiltInDeck = Omit<Deck, 'createdAt' | 'updatedAt'>;

export const BUILT_IN_DECKS: BuiltInDeck[] = [
  { id: 'deck-errors', name: 'Mis errores recurrentes', description: 'Todo lo que fallaste en ejercicios, simulacros y repasos.', icon: 'flame', color: 'coral', builtIn: true, filter: { errorsOnly: true } },
  { id: 'deck-kwt', name: 'Key Word Transformation', description: 'Part 4: transformaciones, patrones y colocaciones exigidas.', icon: 'repeat', color: 'indigo', builtIn: true, filter: { parts: ['P4'] } },
  { id: 'deck-open-cloze', name: 'Open Cloze', description: 'Part 2: preposiciones fijas, inversiones, relativos y conectores.', icon: 'text-cursor', color: 'lavender', builtIn: true, filter: { parts: ['P2'] } },
  { id: 'deck-mc', name: 'Multiple Choice Cloze', description: 'Part 1: collocations y distinciones de significado.', icon: 'list-checks', color: 'sky', builtIn: true, filter: { parts: ['P1'] } },
  { id: 'deck-wf', name: 'Word Formation', description: 'Part 3: familias de palabras, prefijos, sufijos y ortografía.', icon: 'puzzle', color: 'sage', builtIn: true, filter: { parts: ['P3'] } },
  { id: 'deck-phrasal', name: 'Phrasal Verbs', icon: 'move-right', color: 'amber', builtIn: true, filter: { categories: ['phrasal_verb'] } },
  { id: 'deck-idioms', name: 'Idioms', icon: 'sparkles', color: 'rose', builtIn: true, filter: { categories: ['idiom'] } },
  { id: 'deck-collocations', name: 'Collocations', icon: 'link', color: 'teal', builtIn: true, filter: { categories: ['collocation'] } },
  { id: 'deck-fixed', name: 'Fixed Phrases', description: 'Frases fijas y frases preposicionales.', icon: 'pin', color: 'slate', builtIn: true, filter: { categories: ['fixed_phrase', 'prepositional_phrase'] } },
  { id: 'deck-grammar', name: 'Grammar Patterns', description: 'Inversiones, condicionales, cleft, pasivas, causativas y verb patterns.', icon: 'braces', color: 'indigo', builtIn: true, filter: { categories: ['grammar_pattern', 'verb_pattern', 'inversion', 'conditional', 'cleft', 'emphasis', 'passive', 'causative', 'relative_clause', 'comparative', 'reporting', 'tense', 'agreement', 'possessive'] } },
  { id: 'deck-confusing', name: 'Confusing Words', description: 'Palabras confundibles y falsos amigos.', icon: 'split', color: 'coral', builtIn: true, filter: { categories: ['lexical_distinction', 'false_friend'] } },
  { id: 'deck-reading', name: 'Reading', description: 'Parts 5–7: vocabulario y estrategias.', icon: 'book-open', color: 'sky', builtIn: true, filter: { parts: ['P5', 'P6', 'P7'] } },
  { id: 'deck-masterclass', name: 'Masterclass', description: 'Cambridge English Proficiency Masterclass.', icon: 'graduation-cap', color: 'lavender', builtIn: true, filter: { tags: ['masterclass'] } },
  { id: 'deck-strategy', name: 'Estrategias de examen', icon: 'compass', color: 'sage', builtIn: true, filter: { categories: ['strategy'] } },
];
