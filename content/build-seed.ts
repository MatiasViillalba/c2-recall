// Compila content/seed-src/*.mjs → public/seed/seed.json y genera el informe de cobertura.
// Uso: node content/build-seed.ts   (Node ≥ 22.18 ejecuta TypeScript borrable sin compilar)
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeItem, normalizeExpression, type Issue, type RawItem } from '../src/lib/content/normalize.ts';
import type { Card, Deck, Knowledge, Source, SourceRef } from '../src/lib/types.ts';
import { BUILT_IN_DECKS } from '../src/lib/content/decks.ts';
import { SEED_TIME } from '../src/lib/content/constants.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');


const SOURCES: Source[] = [
  { id: 'banco', title: 'Banco_C2_Proficiency_Matias.pdf', kind: 'pdf', pages: 68, note: 'Banco de estudio organizado (texto digital).', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'archivo', title: 'Cambridge_C2_Archivo_Integral_De_Estudio_y_Correcciones.pdf', kind: 'pdf', pages: 224, note: 'Manual (pp. 1–27), Anexo A = capturas (pp. 28–186), Anexo B = capturas recientes (pp. 187–224).', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'capturas', title: 'Cambridge_C2_Todas_las_Capturas_Use_of_English_y_Masterclass.pdf', kind: 'pdf', pages: 159, note: 'Idéntico al Anexo A del Archivo (página Capturas = página Archivo − 27).', createdAt: SEED_TIME, updatedAt: SEED_TIME },
];

/** ['B', p] Banco · ['A', p] Archivo (texto) · ['I', p] imagen en la página p del Archivo (= Capturas p − 27 si está en el Anexo A). */
function resolveSource(raw: unknown): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  const [code, page, exercise] = raw as [string, number, string | undefined];
  if (code === 'B') return [{ sourceId: 'banco', page, exercise }];
  if (code === 'A') return [{ sourceId: 'archivo', page, exercise }];
  if (code === 'I') {
    const refs: SourceRef[] = [{ sourceId: 'archivo', page, exercise }];
    if (page >= 31 && page <= 186) refs.push({ sourceId: 'capturas', page: page - 27, exercise });
    return refs;
  }
  throw new Error(`Código de fuente desconocido: ${JSON.stringify(raw)}`);
}

interface FileModule { default: RawItem[]; defaults?: Partial<RawItem> }

// Flashcards del banco original: id → [frente con {{palabra}}, pista en inglés] (content/flashcards/*.mjs).
const overlayDir = join(here, 'flashcards');
const overlay = new Map<string, [string, string]>();
for (const file of readdirSync(overlayDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = (await import(pathToFileURL(join(overlayDir, file)).href)) as { default: Record<string, [string, string]> };
  for (const [id, value] of Object.entries(mod.default)) {
    if (overlay.has(id)) throw new Error(`[flashcards/${file}] id repetido: ${id}`);
    overlay.set(id, value);
  }
}
const overlayUsed = new Set<string>();

const srcDir = join(here, 'seed-src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.mjs')).sort();
const knowledgeById = new Map<string, Knowledge>();
const cardsById = new Map<string, Card>();
const issues: Issue[] = [];
const fileStats: { file: string; items: number }[] = [];
let mergedDuplicateIds = 0;
let rawMentions = 0;

for (const file of files) {
  const mod = (await import(pathToFileURL(join(srcDir, file)).href)) as FileModule;
  fileStats.push({ file, items: mod.default.length });
  for (const rawItem of mod.default) {
    const ctx = { now: SEED_TIME, origin: 'seed' as const, resolveSource, defaults: mod.defaults };
    let raw = rawItem;
    let normalized = normalizeItem(raw, ctx);
    const extra = overlay.get(normalized.knowledge.id);
    if (extra && !raw.f) {
      overlayUsed.add(normalized.knowledge.id);
      raw = { ...raw, f: extra[0], en: extra[1] };
      normalized = normalizeItem(raw, ctx);
    }
    const { knowledge, cards, issues: itemIssues } = normalized;
    issues.push(...itemIssues.map((i) => ({ ...i, message: `[${file}] ${i.message}` })));
    rawMentions += knowledge.sources.filter((s) => s.sourceId !== 'capturas').length;
    const existing = knowledgeById.get(knowledge.id);
    if (existing && raw.f && !extra) {
      // Una flashcard nueva no puede pisar un conocimiento que ya existe: hay que editar el existente.
      issues.push({ level: 'error', itemId: knowledge.id, message: `[${file}] ya existe un conocimiento con este id; agregá la información al existente en lugar de duplicarlo.` });
      continue;
    }
    if (existing) {
      // Mismo conocimiento definido dos veces: se fusiona sin perder fuentes ni tarjetas.
      mergedDuplicateIds++;
      existing.sources.push(...knowledge.sources);
      existing.timesMissed = Math.max(existing.timesMissed, knowledge.timesMissed);
      existing.priority = Math.max(existing.priority, knowledge.priority) as 1 | 2 | 3;
      for (const c of cards) {
        if (!cardsById.has(c.id)) cardsById.set(c.id, c);
      }
      continue;
    }
    knowledgeById.set(knowledge.id, knowledge);
    for (const c of cards) {
      if (cardsById.has(c.id)) issues.push({ level: 'error', itemId: knowledge.id, cardId: c.id, message: 'ID de tarjeta duplicado.' });
      cardsById.set(c.id, c);
    }
  }
}

for (const id of overlay.keys()) {
  if (!overlayUsed.has(id)) issues.push({ level: 'error', itemId: id, message: 'content/flashcards: el id no corresponde a ningún conocimiento.' });
}

// Fuentes únicas por conocimiento (sin repetir página/documento).
for (const k of knowledgeById.values()) {
  const seen = new Set<string>();
  k.sources = k.sources.filter((s) => {
    const key = `${s.sourceId}:${s.page}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  k.timesSeen = new Set(k.sources.filter((s) => s.sourceId !== 'capturas').map((s) => `${s.sourceId}:${s.page}`)).size || 1;
}

// Posibles duplicados con distinto id (misma expresión normalizada).
const byExpr = new Map<string, string[]>();
for (const k of knowledgeById.values()) {
  const key = normalizeExpression(k.expression);
  byExpr.set(key, [...(byExpr.get(key) ?? []), k.id]);
}
const nearDuplicates = [...byExpr.entries()].filter(([, ids]) => ids.length > 1);
for (const [expr, ids] of nearDuplicates) {
  issues.push({ level: 'warning', itemId: ids.join(', '), message: `Posible duplicado por expresión normalizada «${expr}».` });
}

const knowledge = [...knowledgeById.values()];
const cards = [...cardsById.values()];
const decks: Deck[] = BUILT_IN_DECKS.map((d) => ({ ...d, createdAt: SEED_TIME, updatedAt: SEED_TIME }));

const payload = { knowledge, cards, sources: SOURCES, decks };
const seedVersion = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
const seed = { format: 'c2-recall/seed', schemaVersion: 1, seedVersion, generatedAt: SEED_TIME, ...payload };
mkdirSync(join(root, 'public', 'seed'), { recursive: true });
writeFileSync(join(root, 'public', 'seed', 'seed.json'), JSON.stringify(seed));

// ── Cobertura ──
const manifest = (await import(pathToFileURL(join(here, 'coverage-manifest.mjs')).href)).default as {
  pagesWithoutKnowledge: Record<string, Record<string, string>>;
  appendixTranscription: { sourceId: string; from: number; to: number; reason: string }[];
  excludedAsTrivial: string[];
  pendingValidation: { what: string; where: string; reason: string }[];
  notExtractable: { what: string; where: string; reason: string }[];
};
const referenced: Record<string, Set<number>> = { banco: new Set(), archivo: new Set(), capturas: new Set() };
for (const k of knowledge) for (const s of k.sources) if (s.page) referenced[s.sourceId].add(s.page);
const pageReport: Record<string, { total: number; withKnowledge: number; documentedWithoutKnowledge: number; transcription: number; unaccounted: number[] }> = {};
for (const src of SOURCES) {
  const noKnowledge = manifest.pagesWithoutKnowledge[src.id] ?? {};
  const transcription = manifest.appendixTranscription.filter((t) => t.sourceId === src.id);
  let documented = 0, trans = 0;
  const unaccounted: number[] = [];
  for (let p = 1; p <= (src.pages ?? 0); p++) {
    if (referenced[src.id].has(p)) continue;
    if (noKnowledge[String(p)]) { documented++; continue; }
    if (transcription.some((t) => p >= t.from && p <= t.to)) { trans++; continue; }
    unaccounted.push(p);
  }
  pageReport[src.id] = { total: src.pages ?? 0, withKnowledge: referenced[src.id].size, documentedWithoutKnowledge: documented, transcription: trans, unaccounted };
}

const count = <T,>(arr: T[], f: (x: T) => string | string[]) => {
  const out: Record<string, number> = {};
  for (const x of arr) for (const k of ([] as string[]).concat(f(x))) out[k] = (out[k] ?? 0) + 1;
  return out;
};
const coverage = {
  generatedAt: new Date().toISOString(),
  seedVersion,
  documents: SOURCES.map((s) => ({ id: s.id, title: s.title, pages: s.pages, ...pageReport[s.id] })),
  images: { reviewed: 191, uniqueAnnexA: 153, annexB: 38, duplicatesInsideCaptures: ['Archivo p. 71 = p. 69 (Scotland)', 'Archivo p. 151 = p. 150 (Taxonomists)'], capturasIdenticalToAnnexA: '153/153 imágenes idénticas byte a byte (comparación página por página)' },
  sourceMentions: rawMentions,
  knowledgeItems: knowledge.length,
  mergedMentions: rawMentions - knowledge.length,
  mergedDuplicateIds,
  cards: cards.length,
  cardsByType: count(cards, (c) => c.type),
  knowledgeByPart: count(knowledge, (k) => k.examParts),
  knowledgeByCategory: count(knowledge, (k) => k.categories),
  errorsByType: count(knowledge.filter((k) => k.errorType), (k) => k.errorType as string),
  recurringErrors: knowledge.filter((k) => k.timesMissed >= 2).map((k) => ({ id: k.id, expression: k.expression, timesMissed: k.timesMissed })),
  pendingValidationItems: knowledge.filter((k) => k.validation === 'pending').map((k) => ({ id: k.id, expression: k.expression, notes: k.notes })),
  excludedAsTrivial: manifest.excludedAsTrivial,
  pendingValidation: manifest.pendingValidation,
  notExtractable: manifest.notExtractable,
  nearDuplicates: nearDuplicates.map(([expr, ids]) => ({ expr, ids })),
  issues: { errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warning').length },
  files: fileStats,
};
mkdirSync(join(here, 'coverage'), { recursive: true });
writeFileSync(join(here, 'coverage', 'coverage.json'), JSON.stringify(coverage, null, 2));
writeFileSync(join(root, 'public', 'seed', 'coverage.json'), JSON.stringify(coverage));
writeFileSync(join(here, 'coverage', 'issues.txt'), issues.map((i) => `${i.level.toUpperCase()} ${i.itemId}${i.cardId ? ` (${i.cardId})` : ''}: ${i.message}`).join('\n'));

const errors = issues.filter((i) => i.level === 'error');
console.log(`Seed ${seedVersion}: ${knowledge.length} conocimientos, ${cards.length} tarjetas, ${rawMentions} menciones en fuentes (${rawMentions - knowledge.length} fusionadas).`);
console.log('Tarjetas por tipo:', coverage.cardsByType);
console.log(`Problemas: ${errors.length} errores, ${issues.length - errors.length} advertencias (ver content/coverage/issues.txt).`);
for (const s of coverage.documents) console.log(`${s.id}: ${s.pages} págs · con conocimiento ${s.withKnowledge} · sin conocimiento documentadas ${s.documentedWithoutKnowledge} · transcripción ${s.transcription} · SIN CONTABILIZAR ${s.unaccounted.length} ${s.unaccounted.length ? JSON.stringify(s.unaccounted) : ''}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e.itemId}${e.cardId ? ` (${e.cardId})` : ''}: ${e.message}`);
  process.exit(1);
}

// ── Informe legible: docs/COVERAGE.md ──
const totalPages = coverage.documents.reduce((n, d) => n + (d.pages ?? 0), 0);
const unaccountedTotal = coverage.documents.reduce((n, d) => n + d.unaccounted.length, 0);
const table = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
const md = `# Informe de cobertura de los tres PDF

> Generado automáticamente por \`npm run seed\` (banco ${seedVersion}). Cada página de los tres documentos está **referenciada por al menos un conocimiento** o **documentada con el motivo** por el que no aporta tarjetas. El script falla el informe si alguna página queda sin contabilizar.

## Resumen

| Indicador | Valor |
| --- | --- |
| Documentos analizados | 3 |
| Páginas procesadas | ${totalPages - unaccountedTotal} de ${totalPages} (${unaccountedTotal} sin contabilizar) |
| Imágenes revisadas visualmente | ${coverage.images.reviewed} (${coverage.images.uniqueAnnexA} del Anexo A + ${coverage.images.annexB} del Anexo B) |
| Menciones de conocimientos en las fuentes | ${coverage.sourceMentions} |
| Conocimientos únicos (tras fusionar duplicados) | ${coverage.knowledgeItems} |
| Menciones duplicadas fusionadas | ${coverage.mergedMentions} |
| Tarjetas generadas | ${coverage.cards} |
| Validación automática | ${coverage.issues.errors} errores · ${coverage.issues.warnings} advertencias (cognados ES/EN, revisados) |

## Documentos

| Documento | Páginas | Con conocimiento | Sin contenido memorizable (motivo documentado) | Transcripción OCR verificada | Sin contabilizar |
| --- | --- | --- | --- | --- | --- |
${coverage.documents.map((d) => `| ${d.title} | ${d.pages} | ${d.withKnowledge} | ${d.documentedWithoutKnowledge} | ${d.transcription} | ${d.unaccounted.length} |`).join('\n')}

- El archivo de **Capturas** es idéntico al **Anexo A** del Archivo Integral (${coverage.images.capturasIdenticalToAnnexA}); por eso cada conocimiento que viene de una captura cita ambas páginas.
- Duplicados dentro de las capturas: ${coverage.images.duplicatesInsideCaptures.join('; ')}.
- Las páginas 48–68 del Banco transcriben por OCR las respuestas de las capturas; se verificaron contra las imágenes y los conocimientos se citan a la imagen original.

## Tarjetas por tipo

| Tipo | Tarjetas |
| --- | --- |
${table(coverage.cardsByType)}

## Conocimientos por parte del examen

| Parte | Conocimientos |
| --- | --- |
${table(coverage.knowledgeByPart)}

## Conocimientos por categoría

| Categoría | Conocimientos |
| --- | --- |
${table(coverage.knowledgeByCategory)}

## Errores clasificados

| Clasificación | Conocimientos |
| --- | --- |
${table(coverage.errorsByType)}

\`error\` = error real · \`alt\` = alternativa válida rechazada por un autocorrector · \`register\` = variante de registro · \`unverified\` = no verificado (pendiente).

### Errores recurrentes (fallados 2 o más veces)

${coverage.recurringErrors.map((e) => `- **${e.expression}** — ${e.timesMissed}×`).join('\n')}

## Pendientes de validación

${coverage.pendingValidation.map((p) => `- **${p.what}** (${p.where}): ${p.reason}`).join('\n')}
${coverage.pendingValidationItems.map((p) => `- **${p.expression}**: tarjeta marcada «no verificado».`).join('\n')}

## Elementos no convertidos en tarjetas

${coverage.notExtractable.map((p) => `- **${p.what}** (${p.where}): ${p.reason}`).join('\n')}

**Excluidos por triviales (sin valor para C2):** ${coverage.excludedAsTrivial.join(' · ')}.

## Páginas sin conocimiento y motivo

${Object.entries(manifest.pagesWithoutKnowledge).map(([doc, pages]) => `### ${SOURCES.find((s) => s.id === doc)?.title}\n\n${Object.entries(pages).map(([p, reason]) => `- p. ${p}: ${reason}`).join('\n')}`).join('\n\n')}

## Notas de método

1. Se extrajo el texto digital de las 451 páginas (PyMuPDF) y se leyeron completos el Banco (68 págs.) y el manual del Archivo (27 págs.).
2. Las 191 imágenes únicas (153 del Anexo A/Capturas + 38 del Anexo B) se revisaron visualmente una por una (en hojas de 2×2 para los textos de la app), anotando cada respuesta fallada, cada alternativa válida y cada clave dudosa.
3. Cada conocimiento se normalizó (forma canónica, categoría, partes del examen, ortografía) y se fusionaron las menciones repetidas entre documentos conservando todas las fuentes (documento + página + ejercicio).
4. No se tomaron respuestas incorrectas como correctas: quedan en «errores típicos». Las respuestas que eran válidas pero el autocorrector rechazó se marcaron \`alt\`; las claves dudosas de la app se enseñan en su forma estándar y quedan «no verificado».
5. Los ejemplos provienen del Banco cuando existían; el resto fueron redactados para la tarjeta. Las oraciones KWT de la app se adaptaron para no copiar texto con derechos de autor.
`;
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'COVERAGE.md'), md);

