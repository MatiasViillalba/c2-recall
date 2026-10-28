// Importación de nuevos conocimientos (JSON c2-recall/v1, lista JSON o CSV):
// valida → compara con la biblioteca → vista previa → aplica. Un conocimiento existente
// nunca se reinicia: se le agregan fuentes, ejemplos y tarjetas nuevas, y si volviste a fallarlo
// se registra la recurrencia y sube su prioridad.
import { db } from './db';
import { normalizeExpression, normalizeItem, slugify, type Issue, type NormalizedItem, type RawItem } from './content/normalize.ts';
import { addCards, createKnowledge, enqueue, logRecurrence, updateKnowledge } from './repo';
import type { Card, ImportBatch, Knowledge, Source, SourceRef } from './types';
import { nowIso, uuid } from './util';

export interface ImportPayload {
  format?: string;
  batch?: { title?: string; source?: { title?: string; kind?: Source['kind'] } | string; date?: string };
  items: RawItem[];
}

export function parseImportText(text: string): ImportPayload {
  const trimmed = text.trim().replace(/^```(?:json|csv)?\s*/i, '').replace(/```\s*$/, '');
  if (!trimmed) throw new Error('El contenido está vacío.');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`JSON inválido: ${(e as Error).message}`);
    }
    if (Array.isArray(data)) return { items: data as RawItem[] };
    const obj = data as Record<string, unknown>;
    if (obj.format === 'c2-recall/seed') {
      return { format: 'c2-recall/seed', batch: { title: 'Seed' }, items: (obj.knowledge as RawItem[]) ?? [] };
    }
    const items = (obj.items ?? obj.knowledge ?? obj.cards) as RawItem[] | undefined;
    if (!Array.isArray(items)) throw new Error('El JSON debe tener una lista «items».');
    return { format: obj.format as string | undefined, batch: obj.batch as ImportPayload['batch'], items };
  }
  return { items: parseCsv(trimmed) };
}

/** CSV con encabezados: expression, meaning_es, categories, parts, example_en, example_es, pattern, notes, wrong, source, page, exercise, error_type */
export function parseCsv(text: string): RawItem[] {
  const delimiter = [',', ';', '\t'].sort((a, b) => text.split('\n')[0].split(b).length - text.split('\n')[0].split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const split = (v: string) => v.split('|').map((s) => s.trim()).filter(Boolean);
  return body.map((cells) => {
    const get = (...names: string[]) => {
      for (const n of names) {
        const idx = keys.indexOf(n);
        if (idx >= 0 && cells[idx]?.trim()) return cells[idx].trim();
      }
      return undefined;
    };
    const exEn = get('example_en', 'example');
    const source = get('source');
    return {
      t: get('expression', 'english', 'term'),
      es: get('meaning_es', 'meaning', 'spanish'),
      cat: split(get('categories', 'category') ?? ''),
      parts: split(get('parts', 'exam_parts', 'part') ?? ''),
      ex: exEn ? [[exEn, get('example_es') ?? '']] : [],
      pat: get('pattern', 'structure'),
      note: get('notes', 'note', 'rule'),
      wrong: split(get('wrong', 'wrong_answers', 'mistakes') ?? ''),
      err: get('error_type'),
      qes: get('prompt_es'),
      src: source ? [{ title: source, page: Number(get('page')) || undefined, exercise: get('exercise') }] : [],
      tags: split(get('tags') ?? ''),
    } as RawItem;
  });
}

export interface PlanEntry {
  key: string;
  action: 'add' | 'update' | 'recurrence' | 'skip';
  reason: string;
  incoming: NormalizedItem;
  existing?: Knowledge;
  newCards: Card[];
  duplicateCards: number;
  newSources: SourceRef[];
  newExamples: number;
  selected: boolean;
}

export interface ImportPlan {
  title: string;
  sourceTitle?: string;
  entries: PlanEntry[];
  issues: Issue[];
  newSources: Source[];
  errorsBlocking: number;
}

function sourceIdFor(title: string): string {
  return `src-${slugify(title)}`;
}

export async function planImport(payload: ImportPayload, opts: { title?: string } = {}): Promise<ImportPlan> {
  const now = nowIso();
  const batchSource = typeof payload.batch?.source === 'string' ? { title: payload.batch.source } : payload.batch?.source;
  const title = opts.title ?? payload.batch?.title ?? batchSource?.title ?? `Importación ${new Date().toLocaleDateString('es-AR')}`;
  const knownSources = new Map((await db.sources.toArray()).map((s) => [s.id, s]));
  const newSources = new Map<string, Source>();
  const ensureSource = (t: string, kind: Source['kind'] = 'other'): string => {
    const id = sourceIdFor(t);
    if (!knownSources.has(id) && !newSources.has(id)) newSources.set(id, { id, title: t, kind, createdAt: now, updatedAt: now });
    return id;
  };
  const resolveSource = (raw: unknown): SourceRef[] => {
    if (typeof raw === 'string') return [{ sourceId: knownSources.has(raw) ? raw : ensureSource(raw) }];
    if (Array.isArray(raw)) {
      const [t, page, exercise] = raw as [string, number?, string?];
      return t ? [{ sourceId: knownSources.has(t) ? t : ensureSource(String(t)), page: Number(page) || undefined, exercise }] : [];
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const t = String(o.sourceId ?? o.doc ?? o.title ?? o.source ?? '').trim();
      if (!t) return [];
      return [{ sourceId: knownSources.has(t) ? t : ensureSource(t, (o.kind as Source['kind']) ?? 'other'), page: Number(o.page) || undefined, exercise: o.exercise ? String(o.exercise) : undefined }];
    }
    return [];
  };

  const existing = (await db.knowledge.toArray()).filter((k) => !k.deleted);
  const byId = new Map(existing.map((k) => [k.id, k]));
  const byExpr = new Map<string, Knowledge>();
  for (const k of existing) {
    byExpr.set(normalizeExpression(k.expression), k);
    for (const a of k.aliases) if (!byExpr.has(normalizeExpression(a))) byExpr.set(normalizeExpression(a), k);
  }
  const allCards = await db.cards.toArray();
  const cardsByKnowledge = new Map<string, Card[]>();
  for (const c of allCards) if (!c.deleted) cardsByKnowledge.set(c.knowledgeId, [...(cardsByKnowledge.get(c.knowledgeId) ?? []), c]);

  const issues: Issue[] = [];
  const entries: PlanEntry[] = [];
  const seenInBatch = new Map<string, PlanEntry>();
  const batchId = uuid();
  payload.items.forEach((raw, index) => {
    const withSource = batchSource?.title && !raw.src && !raw.sources ? { ...raw, src: [{ title: batchSource.title, kind: batchSource.kind }] } : raw;
    const norm = normalizeItem(withSource, { now, origin: 'import', importBatchId: batchId, resolveSource });
    issues.push(...norm.issues);
    if (norm.issues.some((i) => i.level === 'error')) {
      entries.push({ key: `${index}`, action: 'skip', reason: norm.issues.find((i) => i.level === 'error')!.message, incoming: norm, newCards: [], duplicateCards: 0, newSources: [], newExamples: 0, selected: false });
      return;
    }
    const exprKey = normalizeExpression(norm.knowledge.expression);
    const dupInBatch = seenInBatch.get(exprKey);
    if (dupInBatch) {
      // Duplicado dentro del mismo lote: se fusiona en la primera aparición.
      dupInBatch.incoming.knowledge.sources.push(...norm.knowledge.sources);
      dupInBatch.incoming.knowledge.examples.push(...norm.knowledge.examples);
      dupInBatch.incoming.cards.push(...norm.cards.filter((c) => !c.id.endsWith(':auto')));
      entries.push({ key: `${index}`, action: 'skip', reason: 'Duplicado dentro del mismo lote (fusionado con la primera aparición).', incoming: norm, newCards: [], duplicateCards: norm.cards.length, newSources: [], newExamples: 0, selected: false });
      return;
    }
    const match = byId.get(norm.knowledge.id) ?? byExpr.get(exprKey);
    let entry: PlanEntry;
    if (!match) {
      if (byId.has(norm.knowledge.id)) norm.knowledge.id = `${norm.knowledge.id}-${batchId.slice(0, 4)}`;
      entry = { key: `${index}`, action: 'add', reason: 'Conocimiento nuevo.', incoming: norm, newCards: norm.cards, duplicateCards: 0, newSources: norm.knowledge.sources, newExamples: norm.knowledge.examples.length, selected: true };
    } else {
      const existingCards = cardsByKnowledge.get(match.id) ?? [];
      const sig = (c: Card) => `${c.type}|${normalizeExpression(c.prompt)}|${normalizeExpression(c.answer)}`;
      const have = new Set(existingCards.map(sig));
      const haveTypes = new Set(existingCards.map((c) => c.type));
      const newCards: Card[] = [];
      let duplicateCards = 0;
      for (const c of norm.cards) {
        // Las tarjetas automáticas solo se agregan si el conocimiento todavía no tiene ese tipo.
        if (have.has(sig(c)) || (c.id.endsWith(':auto') && haveTypes.has(c.type))) { duplicateCards++; continue; }
        newCards.push({ ...c, knowledgeId: match.id, id: `${match.id}:${c.type}:imp-${uuid().slice(0, 8)}` });
      }
      const srcKey = (s: SourceRef) => `${s.sourceId}:${s.page ?? ''}:${s.exercise ?? ''}`;
      const haveSrc = new Set(match.sources.map(srcKey));
      const newSourcesForItem = norm.knowledge.sources.filter((s) => !haveSrc.has(srcKey(s)));
      const haveEx = new Set(match.examples.map((e) => e.en.toLowerCase()));
      const newExamples = norm.knowledge.examples.filter((e) => !haveEx.has(e.en.toLowerCase())).length;
      const isRecurrence = norm.knowledge.wrongAnswers.length > 0 || norm.knowledge.errorType === 'error' || norm.knowledge.timesMissed > 0;
      const action: PlanEntry['action'] = isRecurrence ? 'recurrence' : newCards.length || newSourcesForItem.length || newExamples ? 'update' : 'skip';
      entry = {
        key: `${index}`,
        action,
        reason: action === 'recurrence'
          ? `Ya existe «${match.expression}»: se registra que lo volviste a fallar y sube su prioridad (su historial se conserva).`
          : action === 'update'
            ? `Ya existe «${match.expression}»: se agregan ${newCards.length} tarjeta(s), ${newSourcesForItem.length} fuente(s) y ${newExamples} ejemplo(s) sin reiniciar su historial.`
            : `Ya existe «${match.expression}» con el mismo contenido.`,
        incoming: norm, existing: match, newCards, duplicateCards, newSources: newSourcesForItem, newExamples, selected: action !== 'skip',
      };
    }
    seenInBatch.set(exprKey, entry);
    entries.push(entry);
  });
  return { title, sourceTitle: batchSource?.title, entries, issues, newSources: [...newSources.values()], errorsBlocking: issues.filter((i) => i.level === 'error').length };
}

export interface ApplyOptions {
  via: ImportBatch['via'];
  /** Si volviste a fallar algo ya estudiado, registrar un «Again» en sus tarjetas para que FSRS lo reprograme. */
  registerLapse: boolean;
}

export async function applyImport(plan: ImportPlan, opts: ApplyOptions): Promise<ImportBatch> {
  const now = nowIso();
  const batch: ImportBatch = { id: uuid(), title: plan.title, createdAt: now, updatedAt: now, via: opts.via, sourceTitle: plan.sourceTitle, added: 0, updated: 0, recurrences: 0, skipped: 0, cardsAdded: 0 };
  const usedSourceIds = new Set(plan.entries.filter((e) => e.selected).flatMap((e) => e.incoming.knowledge.sources.map((s) => s.sourceId)));
  const sources = plan.newSources.filter((s) => usedSourceIds.has(s.id));
  if (sources.length) {
    await db.sources.bulkPut(sources);
    await enqueue('sources', sources.map((s) => s.id));
  }
  for (const entry of plan.entries) {
    if (!entry.selected || entry.action === 'skip') {
      batch.skipped++;
      continue;
    }
    const k = entry.incoming.knowledge;
    if (entry.action === 'add') {
      await createKnowledge({ ...k, importBatchId: batch.id }, entry.newCards.map((c) => ({ ...c, knowledgeId: k.id })));
      batch.added++;
      batch.cardsAdded += entry.newCards.length;
      if (k.wrongAnswers.length || k.timesMissed) {
        const logId = uuid();
        await db.errorLogs.add({ id: logId, knowledgeId: k.id, occurredAt: now, wrongAnswer: k.wrongAnswers[0], sourceTitle: plan.sourceTitle ?? plan.title, createdAt: now, updatedAt: now });
        await enqueue('errorLogs', [logId]);
      }
      continue;
    }
    const target = entry.existing!;
    const cur = (await db.knowledge.get(target.id)) ?? target;
    const haveEx = new Set(cur.examples.map((e) => e.en.toLowerCase()));
    await updateKnowledge(target.id, {
      sources: [...cur.sources, ...entry.newSources],
      examples: [...cur.examples, ...k.examples.filter((e) => !haveEx.has(e.en.toLowerCase()))],
      aliases: Array.from(new Set([...cur.aliases, ...k.aliases, ...(k.expression.toLowerCase() !== cur.expression.toLowerCase() ? [k.expression] : [])])),
      confusables: Array.from(new Set([...cur.confusables, ...k.confusables])),
      tags: Array.from(new Set([...cur.tags, ...k.tags])),
      examParts: Array.from(new Set([...cur.examParts, ...k.examParts])),
      categories: Array.from(new Set([...cur.categories, ...k.categories])),
      notes: cur.notes ?? k.notes,
      timesSeen: cur.timesSeen + 1,
    }, { userEdit: false });
    if (entry.newCards.length) {
      await addCards(target.id, entry.newCards);
      batch.cardsAdded += entry.newCards.length;
    }
    if (entry.action === 'recurrence') {
      await logRecurrence(target.id, { wrongAnswer: k.wrongAnswers[0], sourceTitle: plan.sourceTitle ?? plan.title, note: k.notes, asLapse: opts.registerLapse });
      batch.recurrences++;
    } else {
      batch.updated++;
    }
  }
  await db.importBatches.put(batch);
  await enqueue('importBatches', [batch.id]);
  return batch;
}
