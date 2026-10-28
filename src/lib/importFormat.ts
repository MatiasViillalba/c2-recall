// Formato de importación documentado + instrucciones listas para pegarle a Claude.

export const IMPORT_EXAMPLE = {
  format: 'c2-recall/v1',
  batch: { title: 'Mock Exam 3 — Reading & Use of English', source: { title: 'Mock Exam 3', kind: 'mock' } },
  items: [
    {
      expression: 'talk someone out of + -ing',
      meaningEs: 'convencer a alguien de no hacer algo',
      promptEs: 'convencer a alguien de NO hacer algo',
      categories: ['phrasal_verb', 'verb_pattern'],
      examParts: ['P4'],
      pattern: 'TALK + SB + OUT OF + -ING',
      examples: [['She {{talked me out of}} resigning.', 'Me convenció de no renunciar.']],
      wrongAnswers: ['point out the editor not to publish'],
      errorType: 'error',
      notes: 'TALK INTO = convencer de hacerlo; TALK OUT OF = convencer de no hacerlo.',
      confusables: ['talk sb into + -ing'],
      sources: [{ title: 'Mock Exam 3', page: 4, exercise: 'Part 4, ítem 27' }],
      cards: [
        { type: 'kwt', original: 'She persuaded me not to resign.', keyword: 'OUT', prompt: 'She ____ resigning.', answer: 'talked me out of' },
        { type: 'contrast', prompt: '¿Cuál significa «convencer de NO hacer algo»: TALK INTO o TALK OUT OF?', answer: 'TALK SOMEONE OUT OF + -ING', explanation: 'TALK INTO = convencer de hacerlo.' },
      ],
    },
    {
      expression: 'educated (adj.) — make an educated guess',
      meaningEs: 'una suposición fundada',
      categories: ['word_formation', 'collocation'],
      examParts: ['P3'],
      family: [['educate', 'verb'], ['education', 'noun'], ['educated', 'adjective'], ['educational', 'adjective'], ['educative', 'adjective']],
      cards: [{ type: 'wf', prompt: 'She made an ____ guess.', root: 'EDUCATE', answer: 'educated', pos: 'adj.', explanation: 'EDUCATIONAL = que sirve para educar; EDUCATIVE = instructivo (raro).' }],
    },
  ],
};

export const CLAUDE_PROMPT = `Sos mi asistente para C2 Recall, mi app de repetición espaciada para Cambridge C2 Proficiency.
Te paso material (capturas, PDF o texto de ejercicios, correcciones, vocabulario). Tu tarea:

1. Analizá TODO el material y extraé los conocimientos útiles: chunks, collocations, phrasal verbs, idioms, fixed phrases, verb patterns, estructuras gramaticales (inversiones, condicionales, cleft, pasivas, causativas…), familias de Word Formation, distinciones léxicas y falsos amigos.
2. Identificá mis errores: si una respuesta mía está mal, guardala en "wrongAnswers" y marcá "errorType":
   "error" (error real) · "alt" (era correcta pero el autocorrector la rechazó) · "register" (correcta pero de otro registro) · "unverified" (no hay datos suficientes; no inventes la regla).
3. No confundas mi respuesta incorrecta con la forma correcta. Si algo es dudoso, poné "validation": "pending".
4. Devolvé SOLO un bloque JSON con el formato "c2-recall/v1" (ejemplo abajo). Reglas de calidad:
   - "expression": forma canónica en inglés · "meaningEs": significado natural en español (Rioplatense, sin traducción literal).
   - "examples": 1–2 ejemplos naturales C1–C2 [inglés, traducción]; marcá con {{ }} la parte a practicar como hueco.
   - "cards": agregá tarjetas especiales cuando sumen: "kwt" (original, keyword, prompt con ____, answer de 3–8 palabras sin contracciones y con la keyword sin modificar), "wf" (prompt con ____, root, answer, pos), "contrast" (pregunta que distinga expresiones confundibles), "pattern" (regla), "prod" (oración en español para traducir), "fix" (oración con el error).
     La app genera sola las tarjetas «¿Cómo se dice…?» y «Completá» a partir de meaningEs y del ejemplo con {{ }}.
   - El frente nunca debe revelar la respuesta. Una pregunta clara por tarjeta. Ortografía y gramática impecables.
   - "sources": de dónde salió (título, página, ejercicio). "categories" y "examParts" con los valores permitidos.
5. Si un conocimiento probablemente ya existe en mi banco (lo volví a fallar), incluilo igual con "wrongAnswers": la app lo detecta, NO lo duplica, conserva su historial y sube su prioridad.

Valores permitidos:
- categories: chunk, collocation, phrasal_verb, idiom, fixed_phrase, expression, vocabulary, lexical_distinction, false_friend, prepositional_phrase, linking, academic, british, grammar_pattern, verb_pattern, inversion, conditional, cleft, emphasis, passive, causative, relative_clause, comparative, reporting, tense, agreement, possessive, word_formation, spelling, strategy
- examParts: P1 (MC Cloze), P2 (Open Cloze), P3 (Word Formation), P4 (KWT), P5, P6, P7 (Reading), LIS, WRI, SPK, GEN
- cards[].type: es2en, cloze, contrast, kwt, wf, pattern, prod, fix

Ejemplo de salida:
${JSON.stringify(IMPORT_EXAMPLE, null, 2)}`;

export const CSV_TEMPLATE = 'expression,meaning_es,categories,parts,example_en,example_es,pattern,notes,wrong,error_type,source,page,exercise\n"work like magic","funcionar de maravilla","idiom","P4","The new approach {{worked like magic}}.","El nuevo enfoque funcionó de maravilla.","SUBJECT + WORK LIKE MAGIC","WORK, no HAVE.","had magic effects","error","Mock Exam 3",4,"Part 4 ítem 2"';
