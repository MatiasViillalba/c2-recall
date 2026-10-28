# Formato de importación `c2-recall/v1`

La app importa **JSON** (recomendado) o **CSV**. Siempre muestra una vista previa antes de escribir nada, y:

- un conocimiento **nuevo** se crea con sus tarjetas (entran como nuevas en FSRS);
- uno **existente** (mismo `id` o misma expresión normalizada, incluidas variantes) **no se duplica ni se reinicia**: se le agregan fuentes, ejemplos y tarjetas que no tuviera;
- si el ítem trae `wrongAnswers`, `errorType: "error"` o `timesMissed`, y el conocimiento ya existía, se registra una **recurrencia**: sube `timesMissed`, la prioridad pasa a alta y (opcional) se registra un «Again» en sus tarjetas ya estudiadas para que FSRS lo reprograme. El historial previo se conserva.

## Estructura

```json
{
  "format": "c2-recall/v1",
  "batch": { "title": "Mock Exam 3", "source": { "title": "Mock Exam 3", "kind": "mock" } },
  "items": [ { …conocimiento… } ]
}
```

También se acepta directamente una lista `[ {…}, {…} ]`.

## Conocimiento

| Campo | Alias corto | Tipo | Descripción |
| --- | --- | --- | --- |
| `expression` | `t` | string **(obligatorio)** | Forma canónica en inglés: `talk someone out of + -ing`. |
| `meaningEs` | `es` | string **(obligatorio)** | Significado natural en español. |
| `promptEs` | `qes` | string | Texto para la tarjeta «¿Cómo se dice…?» si difiere del significado. |
| `hint` | `h` | string | Pista opcional (p. ej. la keyword). |
| `id` | — | string | Identificador estable (si falta se genera a partir de la expresión). |
| `categories` | `cat` | string[] | Ver valores abajo. |
| `examParts` | `parts` | string[] | `P1`…`P7`, `LIS`, `WRI`, `SPK`, `GEN`. |
| `pattern` | `pat` | string | Estructura: `TALK + SB + OUT OF + -ING`. |
| `examples` | `ex` | `[en, es][]` o `{en, es}[]` | Marcá con `{{ }}` la parte a practicar: genera una tarjeta *Completá*. |
| `wrongAnswers` | `wrong` | string[] | Lo que respondiste mal (literal). |
| `errorType` | `err` | string | `error` (error real), `alt` (era válida; la rechazó un autocorrector), `register` (variante de registro), `unverified` (no verificado → queda pendiente). |
| `validation` | `val` | string | `validated` o `pending`. |
| `notes` | `note` | string | Regla / explicación. |
| `confusables` | `conf` | string[] | Expresiones confundibles y diferencias. |
| `aliases` | `aka` | string[] | Variantes de la misma expresión. |
| `family` | `fam` | `[palabra, categoría, glosa?][]` | Familia de Word Formation. |
| `root` | — | string | Raíz (Word Formation). |
| `tags` | — | string[] | Etiquetas libres (`mock-3`, `listening`…). |
| `sources` | `src` | `{title, page?, exercise?}[]` | Procedencia. Si falta, se usa `batch.source`. |
| `timesMissed` | `miss` | number | Veces que lo fallaste en ese material. |
| `priority` | `prio` | 1–3 | Si falta se deduce de los fallos. |
| `cards` | — | Card[] | Tarjetas especiales (ver abajo). |
| `noauto` | — | `["es2en","cloze"]` | Desactiva tarjetas automáticas. |

**Tarjetas automáticas:** cada conocimiento genera «¿Cómo se dice en inglés…?» (desde `meaningEs`/`promptEs`) y «Completá» (desde el primer ejemplo con `{{ }}`). En `word_formation` y `strategy` están desactivadas: usá tarjetas `wf`/`pattern`.

## Tarjetas especiales (`cards`)

| `type` | Campos | Ejemplo |
| --- | --- | --- |
| `kwt` | `original`, `keyword`, `prompt` (con `____`), `answer`, `alternatives?` | `She persuaded me not to resign.` · `OUT` · `She ____ resigning.` → `talked me out of` |
| `wf` | `prompt` (con `____`), `root`, `answer`, `pos?` | `She made an ____ guess.` · `EDUCATE` → `educated` |
| `contrast` | `prompt`, `answer`, `explanation?` | `¿TALK INTO o TALK OUT OF para «convencer de NO hacer»?` |
| `pattern` | `prompt`, `answer`, `explanation?` | `Después de MAKE A POINT OF, ¿infinitivo o -ING?` |
| `prod` | `prompt` (español), `answer`, `alternatives?` | `Me convencieron de no aceptar la oferta.` |
| `fix` | `prompt` (oración con error), `answer` (corregida) | `At this day and age…` → `In this day and age…` |
| `cloze` | `prompt` (con `____` o `{{ }}`), `answer`, `translation?` | |
| `es2en` | `prompt`, `answer` | |

Alias cortos aceptados: `k`=type, `q`/`s`=prompt, `a`=answer, `o`=original, `kw`=keyword, `x`=explanation, `alts`=alternatives, `tr`=translation.

### Reglas de calidad que la app verifica
- KWT: 3–8 palabras, la keyword presente y sin modificar, sin contracciones.
- El frente no debe contener la respuesta.
- `____` presente en cloze/KWT/WF.
Los problemas aparecen como advertencias en la vista previa (los errores bloquean solo ese ítem).

## Valores permitidos

**categories:** `chunk`, `collocation`, `phrasal_verb`, `idiom`, `fixed_phrase`, `expression`, `vocabulary`, `lexical_distinction`, `false_friend`, `prepositional_phrase`, `linking`, `academic`, `british`, `grammar_pattern`, `verb_pattern`, `inversion`, `conditional`, `cleft`, `emphasis`, `passive`, `causative`, `relative_clause`, `comparative`, `reporting`, `tense`, `agreement`, `possessive`, `word_formation`, `spelling`, `strategy`.

## CSV

Encabezados (coma, punto y coma o tab): `expression, meaning_es, categories, parts, example_en, example_es, pattern, notes, wrong, error_type, prompt_es, source, page, exercise, tags`. Las listas se separan con `|`. Plantilla descargable desde la app (*Agregar → Con Claude*).
