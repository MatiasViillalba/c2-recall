import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCopy, FileUp, History, Inbox, ListPlus, Sparkles, Wand2 } from 'lucide-react';
import { applyImport, parseImportText, planImport, type ImportPlan } from '../lib/importer';
import { CLAUDE_PROMPT, CSV_TEMPLATE, IMPORT_EXAMPLE } from '../lib/importFormat';
import { listInbox, markInbox, type InboxItem } from '../lib/sync';
import { useSyncStatus } from '../lib/hooks';
import { db } from '../lib/db';
import { KnowledgeEditor } from '../components/editors';
import { Button, Chip, cx, EmptyState, inputClass, PageHeader, Panel, SectionTitle, Spinner, Toggle } from '../components/ui';
import { useToast } from '../components/toast';
import { download, formatDate } from '../lib/util';
import type { ImportBatch } from '../lib/types';

type Tab = 'import' | 'manual' | 'inbox' | 'history' | 'claude';

const ACTION_LABEL = {
  add: { label: 'Nuevo', tone: 'sage' },
  update: { label: 'Se completa', tone: 'sky' },
  recurrence: { label: 'Lo volviste a fallar', tone: 'coral' },
  skip: { label: 'Se omite', tone: 'neutral' },
} as const;

export default function AddImport() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'import';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const navigate = useNavigate();
  const toast = useToast();
  const sync = useSyncStatus();
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'import', label: 'Importar', icon: <FileUp size={16} /> },
    { id: 'manual', label: 'Manual', icon: <ListPlus size={16} /> },
    { id: 'inbox', label: 'Bandeja', icon: <Inbox size={16} /> },
    { id: 'history', label: 'Historial', icon: <History size={16} /> },
    { id: 'claude', label: 'Con Claude', icon: <Sparkles size={16} /> },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader eyebrow="Agregar conocimiento" title="Sumá lo que aprendés" subtitle="De a uno o en lote (JSON o CSV generado con Claude). Nada se duplica y nada pierde su historial." />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1 scrollbar-none">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cx('flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition', tab === t.id ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'import' && <Importer />}
      {tab === 'manual' && (
        <Panel className="p-5 sm:p-6">
          <KnowledgeEditor onDone={(id) => { toast('Conocimiento creado: sus tarjetas ya están en tu cola de nuevas'); navigate(`/library/${encodeURIComponent(id)}`); }} />
        </Panel>
      )}
      {tab === 'inbox' && (sync.state === 'unconfigured' || sync.state === 'signed-out'
        ? <EmptyState icon={<Inbox size={24} />} title="La bandeja necesita la sincronización" action={<Button onClick={() => navigate('/settings')}>Ir a Ajustes</Button>}>La integración directa usa tu proyecto gratuito de Supabase: una herramienta autorizada deja lotes en la bandeja y vos los revisás acá antes de importarlos.</EmptyState>
        : <InboxTab />)}
      {tab === 'history' && <HistoryTab />}
      {tab === 'claude' && <ClaudeTab />}
    </div>
  );
}

function Importer({ initialText, inboxItem, onApplied }: { initialText?: string; inboxItem?: InboxItem; onApplied?: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(initialText ?? '');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registerLapse, setRegisterLapse] = useState(true);
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [, force] = useState(0);

  useEffect(() => { if (initialText) void analyze(initialText); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function analyze(source = text) {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const payload = parseImportText(source);
      if (!payload.items.length) throw new Error('No se encontraron conocimientos para importar.');
      setPlan(await planImport(payload, { title: inboxItem?.title }));
    } catch (e) {
      setPlan(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    try {
      const batch = await applyImport(plan, { via: inboxItem ? 'inbox' : 'file', registerLapse });
      setResult(batch);
      setPlan(null);
      setText('');
      toast(`Importación lista: ${batch.added} nuevos, ${batch.updated} completados, ${batch.recurrences} recurrencias`);
      onApplied?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const c = { add: 0, update: 0, recurrence: 0, skip: 0, cards: 0 };
    for (const e of plan?.entries ?? []) {
      if (!e.selected) { c.skip++; continue; }
      c[e.action]++;
      c.cards += e.newCards.length;
    }
    return c;
  }, [plan, plan?.entries.map((e) => e.selected).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) {
    return (
      <Panel className="p-6 text-center anim-pop">
        <h2 className="font-display text-2xl">Importación completada</h2>
        <p className="mt-2 text-muted">{result.added} conocimientos nuevos · {result.updated} completados · {result.recurrences} recurrencias registradas · {result.cardsAdded} tarjetas nuevas · {result.skipped} omitidos</p>
        <p className="mt-1 text-sm text-muted">Las tarjetas nuevas ya entraron a la repetición espaciada. Los conocimientos existentes conservaron su historial.</p>
        <Button className="mt-5" onClick={() => setResult(null)}>Importar otro lote</Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {!plan && (
        <Panel className="p-5">
          <SectionTitle title="Pegá el JSON o CSV" subtitle="Formato c2-recall/v1 (lo genera Claude con las instrucciones de la pestaña «Con Claude») o CSV con encabezados." />
          <textarea
            className={cx(inputClass, 'min-h-[220px] font-mono text-[13px]')}
            placeholder='{ "format": "c2-recall/v1", "items": [ … ] }'
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={busy ? <Spinner /> : <Wand2 size={17} />} onClick={() => void analyze()} disabled={!text.trim() || busy}>Analizar y previsualizar</Button>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[15px] font-medium shadow-soft hover:bg-surface-2">
              <FileUp size={17} /> Elegir archivo
              <input type="file" accept=".json,.csv,.txt,application/json,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); void analyze(t); } e.target.value = ''; }} />
            </label>
          </div>
          {error && <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>}
        </Panel>
      )}

      {plan && (
        <>
          <Panel className="p-5 anim-rise">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">{plan.title}</h2>
                <p className="text-sm text-muted">{plan.entries.length} elementos analizados{plan.sourceTitle ? ` · fuente: ${plan.sourceTitle}` : ''}</p>
              </div>
              <Button variant="ghost" onClick={() => setPlan(null)}>Volver a editar</Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Summary n={counts.add} label="nuevos" tone="text-sage" />
              <Summary n={counts.update} label="se completan" tone="text-sky" />
              <Summary n={counts.recurrence} label="recurrencias" tone="text-coral" />
              <Summary n={counts.skip} label="se omiten" tone="text-muted" />
              <Summary n={counts.cards} label="tarjetas nuevas" tone="text-lavender" />
            </div>
            <div className="mt-4 rounded-2xl border border-line px-4">
              <Toggle checked={registerLapse} onChange={setRegisterLapse} label="Las recurrencias cuentan como «Again»" description="Si ya habías estudiado un conocimiento y lo volviste a fallar, FSRS lo reprograma pronto. Su historial anterior se conserva." />
            </div>
            {plan.issues.length > 0 && (
              <details className="mt-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-amber">{plan.issues.filter((i) => i.level === 'error').length} errores · {plan.issues.filter((i) => i.level === 'warning').length} advertencias de calidad</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-ink-2">
                  {plan.issues.map((i, n) => <li key={n}>{i.level === 'error' ? '⛔' : '⚠️'} <b>{i.itemId}</b>: {i.message}</li>)}
                </ul>
              </details>
            )}
          </Panel>

          <ul className="space-y-2">
            {plan.entries.map((e) => (
              <li key={e.key}>
                <label className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft', !e.selected && 'opacity-55')}>
                  <input type="checkbox" className="mt-1.5 h-4 w-4 accent-[var(--primary)]" checked={e.selected} disabled={e.action === 'skip' && !e.newCards.length && e.reason.startsWith('Duplicado')} onChange={() => { e.selected = !e.selected; force((x) => x + 1); }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg text-ink">{e.incoming.knowledge.expression || '(sin expresión)'}</span>
                      <Chip tone={ACTION_LABEL[e.action].tone}>{ACTION_LABEL[e.action].label}</Chip>
                      {e.newCards.length > 0 && <Chip>{e.newCards.length} tarjeta(s)</Chip>}
                    </div>
                    <p className="text-sm text-muted">{e.incoming.knowledge.meaningEs}</p>
                    <p className="mt-1 text-xs text-ink-2">{e.reason}</p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] flex justify-end gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lifted backdrop-blur lg:bottom-4">
            <Button onClick={() => setPlan(null)}>Cancelar</Button>
            <Button variant="primary" onClick={() => void confirm()} disabled={busy || !(counts.add + counts.update + counts.recurrence)} icon={busy ? <Spinner /> : undefined}>
              Confirmar importación
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5 text-center">
      <div className={cx('text-xl font-semibold tabular-nums', tone)}>{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function InboxTab() {
  const toast = useToast();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [open, setOpen] = useState<InboxItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => listInbox().then(setItems).catch((e) => setError((e as Error).message));
  useEffect(() => { void load(); }, []);
  if (open) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => setOpen(null)}>← Volver a la bandeja</Button>
        <Importer initialText={JSON.stringify(open.payload)} inboxItem={open} onApplied={() => { void markInbox(open.id, 'applied').then(load); }} />
      </div>
    );
  }
  if (error) return <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>;
  if (!items) return <div className="skeleton h-32 rounded-3xl" />;
  if (!items.length) return <EmptyState icon={<Inbox size={24} />} title="La bandeja está vacía">Cuando una herramienta autorizada (por ejemplo, Claude con tu token) envíe un lote, aparece acá para que lo revises.</EmptyState>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink">{it.title}</p>
              <p className="text-xs text-muted">{formatDate(it.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {((it.payload as { items?: unknown[] })?.items?.length ?? 0)} elementos</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => setOpen(it)}>Revisar</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await markInbox(it.id, 'discarded'); toast('Lote descartado', 'info'); void load(); }}>Descartar</Button>
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

function HistoryTab() {
  const batches = useLiveQuery(() => db.importBatches.orderBy('createdAt').reverse().toArray(), []);
  if (!batches) return null;
  if (!batches.length) return <EmptyState icon={<History size={24} />} title="Sin importaciones todavía">El banco inicial (los tres PDF) viene incluido en la app; acá vas a ver cada lote que agregues después.</EmptyState>;
  return (
    <ul className="space-y-2">
      {batches.filter((b) => !b.deleted).map((b) => (
        <li key={b.id}>
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-ink">{b.title}</p>
              <span className="text-xs text-muted">{formatDate(b.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="sage">{b.added} nuevos</Chip>
              <Chip tone="sky">{b.updated} completados</Chip>
              <Chip tone="coral">{b.recurrences} recurrencias</Chip>
              <Chip>{b.cardsAdded} tarjetas</Chip>
              <Chip>{b.via === 'inbox' ? 'desde la bandeja' : 'archivo / pegado'}</Chip>
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

function ClaudeTab() {
  const toast = useToast();
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copiado`); } catch { toast('No se pudo copiar: seleccioná el texto manualmente', 'error'); }
  };
  return (
    <div className="space-y-4">
      <Panel className="p-5 sm:p-6">
        <SectionTitle title="Flujo recomendado (Método 1, sin configuración)" />
        <ol className="list-decimal space-y-2 pl-5 text-[15px] text-ink-2">
          <li>En una conversación con Claude, pegá las <b>instrucciones</b> de abajo y adjuntá tus capturas, PDF o texto del ejercicio.</li>
          <li>Claude te devuelve un bloque JSON <code className="rounded bg-surface-2 px-1">c2-recall/v1</code>. Copialo (o guardalo como archivo .json).</li>
          <li>En la pestaña <b>Importar</b>, pegalo y tocá «Analizar»: vas a ver qué es nuevo, qué ya existía y qué volviste a fallar.</li>
          <li>Confirmá. Las tarjetas nuevas entran a FSRS; las existentes conservan su historial y suben de prioridad si las fallaste.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={<ClipboardCopy size={17} />} onClick={() => void copy(CLAUDE_PROMPT, 'Instrucciones')}>Copiar instrucciones para Claude</Button>
          <Button icon={<ClipboardCopy size={17} />} onClick={() => void copy(JSON.stringify(IMPORT_EXAMPLE, null, 2), 'Ejemplo JSON')}>Copiar ejemplo JSON</Button>
          <Button variant="ghost" onClick={() => download('c2-recall-plantilla.csv', CSV_TEMPLATE, 'text/csv')}>Descargar plantilla CSV</Button>
        </div>
      </Panel>
      <Panel className="p-5 sm:p-6">
        <SectionTitle title="Método 2 · Integración directa (opcional)" />
        <p className="text-[15px] text-ink-2">Con la sincronización activa, en Ajustes podés crear un <b>token de importación</b>. Una herramienta con acceso a internet y a ese token (por ejemplo Claude Code en tu notebook) puede enviar un lote a tu <b>bandeja</b> con una sola llamada HTTPS. Nada entra a tu biblioteca hasta que lo revisás y confirmás. Una conversación normal de Claude no tiene acceso permanente a tu base de datos.</p>
      </Panel>
      <Panel className="p-5 sm:p-6">
        <SectionTitle title="Instrucciones completas" />
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink-2">{CLAUDE_PROMPT}</pre>
      </Panel>
    </div>
  );
}
