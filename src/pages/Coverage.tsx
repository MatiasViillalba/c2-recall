import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { CATEGORY_LABELS, PART_LABELS, CARD_TYPE_LABELS } from '../lib/labels';
import { Chip, PageHeader, Panel, SectionTitle, Stat } from '../components/ui';
import { HBar } from '../components/charts';
import type { CardType, Category, ExamPart } from '../lib/types';

interface CoverageReport {
  generatedAt: string;
  seedVersion: string;
  documents: { id: string; title: string; pages: number; withKnowledge: number; documentedWithoutKnowledge: number; transcription: number; unaccounted: number[] }[];
  images: { reviewed: number; uniqueAnnexA: number; annexB: number; duplicatesInsideCaptures: string[]; capturasIdenticalToAnnexA: string };
  sourceMentions: number;
  knowledgeItems: number;
  mergedMentions: number;
  cards: number;
  cardsByType: Record<CardType, number>;
  knowledgeByPart: Record<ExamPart, number>;
  knowledgeByCategory: Record<Category, number>;
  errorsByType: Record<string, number>;
  recurringErrors: { id: string; expression: string; timesMissed: number }[];
  pendingValidationItems: { id: string; expression: string; notes?: string }[];
  excludedAsTrivial: string[];
  pendingValidation: { what: string; where: string; reason: string }[];
  notExtractable: { what: string; where: string; reason: string }[];
  issues: { errors: number; warnings: number };
}

export default function Coverage() {
  const [r, setR] = useState<CoverageReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}seed/coverage.json`).then((x) => x.json()).then(setR).catch((e) => setErr(String(e)));
  }, []);
  if (err) return <p className="p-8 text-coral">No se pudo cargar el informe: {err}</p>;
  if (!r) return <div className="mx-auto max-w-4xl px-4 py-10"><div className="skeleton h-64 rounded-3xl" /></div>;
  const totalPages = r.documents.reduce((n, d) => n + d.pages, 0);
  const unaccounted = r.documents.reduce((n, d) => n + d.unaccounted.length, 0);
  return (
    <div className="mx-auto max-w-4xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader eyebrow="Informe verificable" title="Cobertura de tus tres PDF" subtitle={`Generado al compilar el banco inicial (versión ${r.seedVersion}). Cada página está referenciada por un conocimiento o documentada con el motivo por el que no aporta tarjetas.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Páginas procesadas" value={`${totalPages - unaccounted}/${totalPages}`} sub={unaccounted ? `${unaccounted} sin contabilizar` : 'todas contabilizadas'} />
        <Stat label="Imágenes revisadas" value={r.images.reviewed} sub={`${r.images.uniqueAnnexA} Anexo A + ${r.images.annexB} Anexo B`} />
        <Stat label="Conocimientos" value={r.knowledgeItems} sub={`${r.sourceMentions} menciones → ${r.mergedMentions} fusionadas`} />
        <Stat label="Tarjetas generadas" value={r.cards} sub={`${r.issues.errors} errores · ${r.issues.warnings} advertencias`} />
      </div>

      <Panel className="mt-4 p-5">
        <SectionTitle title="Documentos" />
        {r.documents.map((d) => (
          <div key={d.id} className="border-b border-line py-3 last:border-0">
            <p className="font-medium text-ink">{d.title}</p>
            <HBar label={`${d.pages} páginas`} value={d.withKnowledge} total={d.pages} sub={`${d.withKnowledge} con conocimiento · ${d.documentedWithoutKnowledge} sin contenido memorizable (motivo documentado) · ${d.transcription} transcripción OCR verificada`} />
            {d.unaccounted.length > 0 && <p className="text-sm text-coral">Sin contabilizar: {d.unaccounted.join(', ')}</p>}
          </div>
        ))}
        <p className="mt-3 text-sm text-muted">{r.images.capturasIdenticalToAnnexA} Duplicados dentro de las capturas: {r.images.duplicatesInsideCaptures.join(' · ')}.</p>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle title="Tarjetas por tipo" />
          {Object.entries(r.cardsByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => <HBar key={t} label={CARD_TYPE_LABELS[t as CardType]?.label ?? t} value={n} total={r.cards} sub={String(n)} tone="var(--lavender)" />)}
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Conocimientos por parte del examen" />
          {Object.entries(r.knowledgeByPart).sort((a, b) => b[1] - a[1]).map(([p, n]) => <HBar key={p} label={PART_LABELS[p as ExamPart]?.long ?? p} value={n} total={r.knowledgeItems} sub={String(n)} />)}
        </Panel>
      </div>

      <Panel className="mt-4 p-5">
        <SectionTitle title="Errores clasificados" subtitle="Error real · alternativa válida (autocorrector) · variante de registro · no verificado" />
        <div className="flex flex-wrap gap-2">
          {Object.entries(r.errorsByType).map(([t, n]) => <Chip key={t} tone={t === 'error' ? 'coral' : t === 'alt' ? 'sage' : t === 'register' ? 'amber' : 'neutral'}>{t === 'error' ? 'Errores reales' : t === 'alt' ? 'Alternativas válidas' : t === 'register' ? 'Variantes de registro' : 'No verificados'}: {n}</Chip>)}
        </div>
        <p className="mt-4 text-sm font-semibold text-ink-2">Errores recurrentes (fallados 2+ veces)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{r.recurringErrors.map((e) => <Chip key={e.id} tone="coral">{e.expression} · {e.timesMissed}×</Chip>)}</div>
      </Panel>

      <Panel className="mt-4 p-5">
        <SectionTitle title="Pendientes de validación" />
        <ul className="space-y-2 text-sm">
          {r.pendingValidation.map((p, i) => <li key={i}><b className="text-ink">{p.what}</b> <span className="text-muted">({p.where})</span> — {p.reason}</li>)}
          {r.pendingValidationItems.map((p) => <li key={p.id}><b className="text-ink">{p.expression}</b> — marcado «no verificado» en la biblioteca.</li>)}
        </ul>
      </Panel>

      <Panel className="mt-4 p-5">
        <SectionTitle title="Elementos no convertidos en tarjetas" />
        <ul className="space-y-2 text-sm">
          {r.notExtractable.map((p, i) => <li key={i}><b className="text-ink">{p.what}</b> <span className="text-muted">({p.where})</span> — {p.reason}</li>)}
        </ul>
        <p className="mt-4 text-sm font-semibold text-ink-2">Excluidos por triviales (sin valor para C2)</p>
        <p className="mt-1 text-sm text-muted">{r.excludedAsTrivial.join(' · ')}</p>
      </Panel>

      <Panel className="mt-4 mb-10 p-5">
        <SectionTitle title="Categorías" />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(r.knowledgeByCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => <Chip key={c} tone="lavender">{CATEGORY_LABELS[c as Category] ?? c}: {n}</Chip>)}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted"><FileCheck2 size={14} /> Los ejemplos provienen del Banco cuando existían; el resto fueron redactados para la tarjeta. Las oraciones KWT de la app Use of English PRO se adaptaron (no se copian textos con derechos de autor).</p>
      </Panel>
    </div>
  );
}
