# Informe de cobertura de los tres PDF

> Generado automáticamente por `npm run seed` (banco 3452a677c380). Cada página de los tres documentos está **referenciada por al menos un conocimiento** o **documentada con el motivo** por el que no aporta tarjetas. El script falla el informe si alguna página queda sin contabilizar.

## Resumen

| Indicador | Valor |
| --- | --- |
| Documentos analizados | 3 |
| Páginas procesadas | 451 de 451 (0 sin contabilizar) |
| Imágenes revisadas visualmente | 191 (153 del Anexo A + 38 del Anexo B) |
| Menciones de conocimientos en las fuentes | 1622 |
| Conocimientos únicos (tras fusionar duplicados) | 713 |
| Menciones duplicadas fusionadas | 909 |
| Tarjetas generadas | 1521 |
| Validación automática | 0 errores · 6 advertencias (cognados ES/EN, revisados) |

## Documentos

| Documento | Páginas | Con conocimiento | Sin contenido memorizable (motivo documentado) | Transcripción OCR verificada | Sin contabilizar |
| --- | --- | --- | --- | --- | --- |
| Banco_C2_Proficiency_Matias.pdf | 68 | 42 | 5 | 21 | 0 |
| Cambridge_C2_Archivo_Integral_De_Estudio_y_Correcciones.pdf | 224 | 200 | 24 | 0 | 0 |
| Cambridge_C2_Todas_las_Capturas_Use_of_English_y_Masterclass.pdf | 159 | 140 | 19 | 0 | 0 |

- El archivo de **Capturas** es idéntico al **Anexo A** del Archivo Integral (153/153 imágenes idénticas byte a byte (comparación página por página)); por eso cada conocimiento que viene de una captura cita ambas páginas.
- Duplicados dentro de las capturas: Archivo p. 71 = p. 69 (Scotland); Archivo p. 151 = p. 150 (Taxonomists).
- Las páginas 48–68 del Banco transcriben por OCR las respuestas de las capturas; se verificaron contra las imágenes y los conocimientos se citan a la imagen original.

## Tarjetas por tipo

| Tipo | Tarjetas |
| --- | --- |
| cloze | 620 |
| es2en | 572 |
| wf | 180 |
| kwt | 91 |
| contrast | 31 |
| pattern | 18 |
| fix | 7 |
| prod | 2 |

## Conocimientos por parte del examen

| Parte | Conocimientos |
| --- | --- |
| P1 | 309 |
| P2 | 235 |
| P3 | 130 |
| P4 | 87 |
| SPK | 19 |
| WRI | 13 |
| P6 | 10 |
| P5 | 6 |

## Conocimientos por categoría

| Categoría | Conocimientos |
| --- | --- |
| collocation | 189 |
| word_formation | 125 |
| idiom | 76 |
| phrasal_verb | 66 |
| vocabulary | 66 |
| prepositional_phrase | 59 |
| verb_pattern | 50 |
| fixed_phrase | 44 |
| linking | 34 |
| grammar_pattern | 32 |
| lexical_distinction | 26 |
| expression | 19 |
| inversion | 15 |
| academic | 13 |
| comparative | 12 |
| passive | 10 |
| emphasis | 10 |
| conditional | 9 |
| relative_clause | 8 |
| spelling | 8 |
| tense | 7 |
| strategy | 7 |
| false_friend | 6 |
| cleft | 4 |
| reporting | 3 |
| causative | 3 |
| possessive | 3 |
| agreement | 2 |

## Errores clasificados

| Clasificación | Conocimientos |
| --- | --- |
| error | 137 |
| alt | 4 |
| unverified | 4 |
| register | 1 |

`error` = error real · `alt` = alternativa válida rechazada por un autocorrector · `register` = variante de registro · `unverified` = no verificado (pendiente).

### Errores recurrentes (fallados 2 o más veces)

- **in this day and age** — 4×
- **at the drop of a hat** — 3×
- **be kept waiting** — 2×
- **need + object + -ing (passive meaning)** — 2×
- **have someone do something** — 2×
- **get something out of the way** — 2×
- **talk someone into / out of + -ing** — 3×
- **provided / providing (that) + clause** — 2×
- **be / feel at ease with someone** — 2×
- **come to be regarded as** — 2×
- **put something down to something** — 3×
- **It was not until… that…** — 2×
- **it dawned on someone (that…)** — 4×
- **take exception to** — 3×
- **be justified in + -ing** — 2×
- **at a loss as to / for words / to know** — 3×
- **result in (effect) vs result from (cause)** — 3×
- **possessive 's / s' (the experts' inspection)** — 3×
- **hope / expectation / chance of + someone + -ing** — 2×
- **there is no expectation of… (no ≠ little)** — 2×
- **have no / not have any intention of + -ing** — 2×
- **Rumour has it (that)…** — 2×
- **reach a decision / an agreement / a verdict** — 2×
- **make a good / poor job of + -ing** — 2×
- **work like magic** — 2×
- **get off to a flying start** — 2×
- **since + present perfect (≠ after)** — 3×
- **Were it not for + noun** — 3×
- **Had it not been for + noun** — 3×
- **entrenched in** — 2×
- **If you're going to… vs If you happen to…** — 2×
- **educated (adj.) — make an educated guess** — 2×
- **provincial (adj.) — a provincial outlook** — 2×
- **irresistible (adj.) — an irresistible urge to** — 2×
- **Gapped Text: Backward – Forward – Function (BFF)** — 2×
- **implicit opinion: hardly a promising basis / a flawed assumption / a stretch** — 2×
- **15-second check (KWT & Open Cloze)** — 2×

## Pendientes de validación

- **Open Cloze OC3, ítem 8: IF vs AFTER** (Archivo p. 15): El propio archivo indica que no hay clave comprobable; no se creó tarjeta para no inventar la regla.
- **KWT 3 del simulacro** (Archivo p. 9): La pregunta no figura en las capturas (resultado global 3/12); no se reconstruye.
- **Reading Part 6 y Part 7 del simulacro (0/14 y 0/10)** (Archivo p. 3): No se aportaron preguntas ni respuestas; no se tratan como fallos demostrados.
- **Claves dudosas de la app: «works naturally to», «to partake a code», «liable of falling», «at risk from being wiped out»** (Banco p. 3; capturas MC): Se enseña la forma estándar y la tarjeta queda marcada «no verificado» respecto de la clave de la app.
- **come naturally to someone**: tarjeta marcada «no verificado».
- **partake of / in**: tarjeta marcada «no verificado».
- **liable to + infinitive**: tarjeta marcada «no verificado».
- **at risk of + -ing**: tarjeta marcada «no verificado».

## Elementos no convertidos en tarjetas

- **Ejercicio Masterclass «Verb forms» (Freedom & Leisure)** (Archivo p. 174 (imagen)): La imagen muestra el enunciado sin las respuestas; las correcciones provienen del texto (Archivo p. 20, Banco p. 24).
- **Ejercicio Introduction del Masterclass** (Archivo p. 169 (imagen)): No hay respuestas del estudiante visibles; se incorporaron los adjetivos y expresiones como vocabulario.
- **Ejercicios del chat pendientes (E1, E2, E3, E4, E6 7–10, E12 9–10, E13 6–10)** (Banco pp. 39–47): No hay respuestas del estudiante; sus oraciones se usaron como tarjetas KWT/cloze nuevas (no como errores).
- **Recursos de Listening (canales de YouTube, rutina de 90 minutos) y libros oficiales** (Archivo pp. 23–25): Material de referencia, no conocimiento lingüístico memorizable.

**Excluidos por triviales (sin valor para C2):** at least · in order to · at the same time · within the next hour · belong to · mirror (verbo) · exhibit (verbo) · deep sleep · perspective · word pool · highlight · on time (se conservó solo el contraste on time / in time) · respuestas gramaticales básicas de los textos 10/10: artículos, pronombres personales, auxiliares simples y preposiciones de lugar.

## Páginas sin conocimiento y motivo

### Banco_C2_Proficiency_Matias.pdf

- p. 1: Portada (objetivo, materiales y puntajes de la app).
- p. 2: Índice, leyenda de íconos y enlaces a recursos oficiales.
- p. 38: Historial de resultados (puntajes por fecha); los errores que resume están incorporados desde sus páginas de detalle.
- p. 44: Claves de E1–E4: sus conocimientos están referenciados en las páginas de los enunciados (pp. 39–40).
- p. 47: Claves de E12–E13: sus conocimientos están referenciados en las páginas de los enunciados (pp. 42–43).

### Cambridge_C2_Archivo_Integral_De_Estudio_y_Correcciones.pdf

- p. 1: Portada y descripción del dossier.
- p. 24: Rutina de Listening y enlaces a libros/recursos oficiales: información útil pero no son conocimientos lingüísticos (se citan en el informe).
- p. 28: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 29: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 30: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 44: Texto de la app respondido 10/10 con respuestas básicas (artículos, auxiliares, vocabulario B1–B2); revisado, sin conocimiento C2 nuevo. (Musical Gifts: began, was, answer to, who, trying, can, not, right).
- p. 71: Captura duplicada de la p. 69 (Scotland’s mountain ridges).
- p. 110: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 142: MC Grey Glacier 10/10: vocabulario básico (broke off, rupture, measured, floated, rare, popular, located, field).
- p. 145: MC Hurricane Harvey 10/10: vocabulario básico (likely, event, assessments, shows, worse, estimated, costly, combined).
- p. 151: Captura duplicada de la p. 150 (Taxonomists).
- p. 155: MC Golden Eagle 10/10: vocabulario básico (practically, spread, supplies, recently, spotted, slowly, far, loss).
- p. 168: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 179: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 180: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 181: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 182: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 183: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 184: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 185: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 186: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 187: Portada del libro Cambridge English Proficiency 2 (Authentic Examination Papers).
- p. 188: Portada del libro C2 Proficiency Trainer 1.
- p. 201: Tabla de resultados del simulacro por parte (OC 2/8, WF 3/8, KWT 3/12, MC 6/8, P5 8/12, P6 0/14, P7 0/10); los ítems con error están incorporados desde sus capturas.

### Cambridge_C2_Todas_las_Capturas_Use_of_English_y_Masterclass.pdf

- p. 1: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 2: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 3: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 17: Texto de la app respondido 10/10 con respuestas básicas (artículos, auxiliares, vocabulario B1–B2); revisado, sin conocimiento C2 nuevo. (Musical Gifts).
- p. 44: Captura duplicada de la p. 42 (Scotland’s mountain ridges).
- p. 83: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 115: MC Grey Glacier 10/10: vocabulario básico.
- p. 118: MC Hurricane Harvey 10/10: vocabulario básico.
- p. 124: Captura duplicada de la p. 123 (Taxonomists).
- p. 128: MC Golden Eagle 10/10: vocabulario básico.
- p. 141: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 152: Portada, índice o separador de sección del archivo de capturas: sin contenido lingüístico.
- p. 153: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 154: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 155: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 156: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 157: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 158: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.
- p. 159: Captura de la plataforma Use of English PRO (paneles de progreso, navegación o diálogo de chat): sin contenido lingüístico.

## Notas de método

1. Se extrajo el texto digital de las 451 páginas (PyMuPDF) y se leyeron completos el Banco (68 págs.) y el manual del Archivo (27 págs.).
2. Las 191 imágenes únicas (153 del Anexo A/Capturas + 38 del Anexo B) se revisaron visualmente una por una (en hojas de 2×2 para los textos de la app), anotando cada respuesta fallada, cada alternativa válida y cada clave dudosa.
3. Cada conocimiento se normalizó (forma canónica, categoría, partes del examen, ortografía) y se fusionaron las menciones repetidas entre documentos conservando todas las fuentes (documento + página + ejercicio).
4. No se tomaron respuestas incorrectas como correctas: quedan en «errores típicos». Las respuestas que eran válidas pero el autocorrector rechazó se marcaron `alt`; las claves dudosas de la app se enseñan en su forma estándar y quedan «no verificado».
5. Los ejemplos provienen del Banco cuando existían; el resto fueron redactados para la tarjeta. Las oraciones KWT de la app se adaptaron para no copiar texto con derechos de autor.
