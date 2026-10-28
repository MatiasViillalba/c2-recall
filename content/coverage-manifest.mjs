// Cobertura verificable: toda página de los tres PDF debe estar referenciada por al menos un conocimiento
// o figurar aquí con el motivo por el que no aporta tarjetas. El script build-seed.ts falla el informe
// («SIN CONTABILIZAR») si alguna página no cumple ninguna de las dos condiciones.
const platform = 'Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.';
const divider = 'Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.';
const trivialOC = 'Texto de la app respondido 10/10 con respuestas básicas (artículos, auxiliares, vocabulario B1–B2); revisado, sin conocimiento C2 nuevo.';

export default {
  pagesWithoutKnowledge: {
    banco: {
      1: 'Portada (objetivo, materiales y puntajes de la app).',
      2: 'Índice, leyenda de íconos y enlaces a recursos oficiales.',
      38: 'Historial de resultados (puntajes por fecha); los errores que resume están incorporados desde sus páginas de detalle.',
      44: 'Claves de E1–E4: sus conocimientos están referenciados en las páginas de los enunciados (pp. 39–40).',
      47: 'Claves de E12–E13: sus conocimientos están referenciados en las páginas de los enunciados (pp. 42–43).',
    },
    archivo: {
      1: 'Portada y descripción del dossier.',
      24: 'Rutina de Listening y enlaces a libros/recursos oficiales: información útil pero no son conocimientos lingüísticos (se citan en el informe).',
      28: divider, 29: divider, 30: divider, 110: divider, 168: divider, 179: divider,
      44: trivialOC + ' (Musical Gifts: began, was, answer to, who, trying, can, not, right).',
      142: 'MC Grey Glacier 10/10: vocabulario básico (broke off, rupture, measured, floated, rare, popular, located, field).',
      145: 'MC Hurricane Harvey 10/10: vocabulario básico (likely, event, assessments, shows, worse, estimated, costly, combined).',
      155: 'MC Golden Eagle 10/10: vocabulario básico (practically, spread, supplies, recently, spotted, slowly, far, loss).',
      71: 'Captura duplicada de la p. 69 (Scotland’s mountain ridges).',
      151: 'Captura duplicada de la p. 150 (Taxonomists).',
      180: platform, 181: platform, 182: platform, 183: platform, 184: platform, 185: platform, 186: platform,
      187: 'Portada del libro Cambridge English Proficiency 2 (Authentic Examination Papers).',
      188: 'Portada del libro C2 Proficiency Trainer 1.',
      201: 'Tabla de resultados del simulacro por parte (OC 2/8, WF 3/8, KWT 3/12, MC 6/8, P5 8/12, P6 0/14, P7 0/10); los ítems con error están incorporados desde sus capturas.',
    },
    capturas: {
      1: divider, 2: divider, 3: divider, 83: divider, 141: divider, 152: divider,
      17: trivialOC + ' (Musical Gifts).',
      44: 'Captura duplicada de la p. 42 (Scotland’s mountain ridges).',
      115: 'MC Grey Glacier 10/10: vocabulario básico.',
      118: 'MC Hurricane Harvey 10/10: vocabulario básico.',
      124: 'Captura duplicada de la p. 123 (Taxonomists).',
      128: 'MC Golden Eagle 10/10: vocabulario básico.',
      153: platform, 154: platform, 155: platform, 156: platform, 157: platform, 158: platform, 159: platform,
    },
  },
  appendixTranscription: [
    { sourceId: 'banco', from: 48, to: 68, reason: 'Apéndices A y B: transcripción OCR de las 78 Open Cloze y 55 Multiple Choice de las capturas. Se verificó contra las imágenes originales y cada conocimiento se referencia a la captura (más precisa que el OCR).' },
  ],
  excludedAsTrivial: [
    'at least', 'in order to', 'at the same time', 'within the next hour', 'belong to', 'mirror (verbo)', 'exhibit (verbo)', 'deep sleep',
    'perspective', 'word pool', 'highlight', 'on time (se conservó solo el contraste on time / in time)',
    'respuestas gramaticales básicas de los textos 10/10: artículos, pronombres personales, auxiliares simples y preposiciones de lugar',
  ],
  pendingValidation: [
    { what: 'Open Cloze OC3, ítem 8: IF vs AFTER', where: 'Archivo p. 15', reason: 'El propio archivo indica que no hay clave comprobable; no se creó tarjeta para no inventar la regla.' },
    { what: 'KWT 3 del simulacro', where: 'Archivo p. 9', reason: 'La pregunta no figura en las capturas (resultado global 3/12); no se reconstruye.' },
    { what: 'Reading Part 6 y Part 7 del simulacro (0/14 y 0/10)', where: 'Archivo p. 3', reason: 'No se aportaron preguntas ni respuestas; no se tratan como fallos demostrados.' },
    { what: 'Claves dudosas de la app: «works naturally to», «to partake a code», «liable of falling», «at risk from being wiped out»', where: 'Banco p. 3; capturas MC', reason: 'Se enseña la forma estándar y la tarjeta queda marcada «no verificado» respecto de la clave de la app.' },
  ],
  notExtractable: [
    { what: 'Ejercicio Masterclass «Verb forms» (Freedom & Leisure)', where: 'Archivo p. 174 (imagen)', reason: 'La imagen muestra el enunciado sin las respuestas; las correcciones provienen del texto (Archivo p. 20, Banco p. 24).' },
    { what: 'Ejercicio Introduction del Masterclass', where: 'Archivo p. 169 (imagen)', reason: 'No hay respuestas del estudiante visibles; se incorporaron los adjetivos y expresiones como vocabulario.' },
    { what: 'Ejercicios del chat pendientes (E1, E2, E3, E4, E6 7–10, E12 9–10, E13 6–10)', where: 'Banco pp. 39–47', reason: 'No hay respuestas del estudiante; sus oraciones se usaron como tarjetas KWT/cloze nuevas (no como errores).' },
    { what: 'Recursos de Listening (canales de YouTube, rutina de 90 minutos) y libros oficiales', where: 'Archivo pp. 23–25', reason: 'Material de referencia, no conocimiento lingüístico memorizable.' },
  ],
};
