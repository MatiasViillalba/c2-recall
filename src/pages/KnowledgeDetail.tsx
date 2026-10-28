import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive, ArchiveRestore, ArrowLeft, CheckCircle2, Flag, GitMerge, Pause, Pencil, Play, Plus, RotateCcw, Sparkles, Star, Trash2, TriangleAlert, Volume2,
} from 'lucide-react';
import { db } from '../lib/db';
import {
  deleteCard, flagCard, logRecurrence, mergeKnowledge, resetCard, setCardSuspended, setDifficult, setKnowledgeStatus, toggleFavorite,
} from '../lib/repo';
import { CARD_TYPE_LABELS, STATE_LABELS } from '../lib/labels';
import { KnowledgeDetails, Highlighted } from '../components/StudyCard';
import { Button, Chip, cx, EmptyState, Field, IconButton, inputClass, Modal, Panel, SectionTitle, Toggle } from '../components/ui';
import { CardEditor, KnowledgeEditor } from '../components/editors';
import { useToast } from '../components/toast';
import { speak } from '../lib/speech';
import { formatDate, formatInterval, relativeDue } from '../lib/util';
import { normalizeExpression, stripCloze } from '../lib/content/normalize.ts';
import type { Card } from '../lib/types';

const RATING_NAMES = ['Reset', 'Again', 'Hard', 'Good', 'Easy'];

export default function KnowledgeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const kid = decodeURIComponent(id);
  const data = useLiveQuery(async () => {
    const k = await db.knowledge.get(kid);
    if (!k) return null;
    const cards = (await db.cards.where('knowledgeId').equals(kid).toArray()).filter((c) => !c.deleted);
    const states = await db.cardStates.bulkGet(cards.map((c) => c.id));
    const reviews = (await db.reviews.where('knowledgeId').equals(kid).toArray()).filter((r) => !r.deleted).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    const errors = await db.errorLogs.where('knowledgeId').equals(kid).toArray();
    const sources = new Map((await db.sources.toArray()).map((s) => [s.id, s]));
    return { k, cards, states, reviews, errors, sources };
  }, [kid]);
  const [editing, setEditing] = useState<'knowledge' | Card | 'new-card' | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [missOpen, setMissOpen] = useState(false);

  if (data === undefined) return <div className="mx-auto max-w-4xl px-4 py-10"><div className="skeleton h-40 rounded-3xl" /></div>;
  if (data === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState icon={<TriangleAlert size={24} />} title="No encontramos este conocimiento" action={<Button onClick={() => navigate('/library')}>Ir a la biblioteca</Button>}>Puede haberse fusionado o eliminado.</EmptyState>
      </div>
    );
  }
  const { k, cards, states, reviews, errors, sources } = data;
  const cardById = new Map(cards.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-4xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-8 lg:pt-8">
      <button type="button" onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> Volver</button>

      <Panel className="p-6 sm:p-8 anim-rise">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{k.expression}</h1>
            <p className="mt-2 text-lg text-ink-2">{k.meaningEs}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <IconButton label="Escuchar" onClick={() => speak(k.expression)}><Volume2 size={20} /></IconButton>
            <IconButton label={k.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'} onClick={() => void toggleFavorite(k.id)}><Star size={20} className={k.favorite ? 'fill-amber text-amber' : ''} /></IconButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {k.timesMissed > 0 && <Chip tone="coral">fallado {k.timesMissed}×</Chip>}
          <Chip tone={k.priority >= 3 ? 'coral' : k.priority === 2 ? 'amber' : 'neutral'}>prioridad {k.priority === 3 ? 'alta' : k.priority === 2 ? 'media' : 'normal'}</Chip>
          <Chip>visto en {k.timesSeen} fuente(s)</Chip>
          <Chip>agregado {formatDate(k.createdAt)}</Chip>
          {k.status !== 'active' && <Chip tone="sage">{k.status === 'mastered' ? 'dominado' : 'archivado'}</Chip>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" icon={<Sparkles size={17} />} onClick={() => navigate(`/study/session?mode=custom&knowledge=${encodeURIComponent(k.id)}&size=10`)}>Practicar</Button>
          <Button icon={<Pencil size={16} />} onClick={() => setEditing('knowledge')}>Editar</Button>
          <Button icon={<TriangleAlert size={16} />} onClick={() => setMissOpen(true)}>Lo volví a fallar</Button>
          <Button variant="ghost" icon={<TriangleAlert size={16} />} onClick={() => void setDifficult(k.id, !k.markedDifficult).then(() => toast(k.markedDifficult ? 'Ya no está marcado como difícil' : 'Marcado como difícil: prioridad alta', 'info'))}>{k.markedDifficult ? 'Quitar «difícil»' : 'Marcar difícil'}</Button>
          <Button variant="ghost" icon={<CheckCircle2 size={16} />} onClick={() => void setKnowledgeStatus(k.id, k.status === 'mastered' ? 'active' : 'mastered').then(() => toast(k.status === 'mastered' ? 'Vuelve a estar activo' : 'Marcado como dominado: no se introducirán sus tarjetas nuevas', 'info'))}>{k.status === 'mastered' ? 'Quitar «dominado»' : 'Marcar dominado'}</Button>
          <Button variant="ghost" icon={k.status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />} onClick={() => void setKnowledgeStatus(k.id, k.status === 'archived' ? 'active' : 'archived').then(() => toast(k.status === 'archived' ? 'Restaurado' : 'Archivado: no aparecerá en el estudio', 'info'))}>{k.status === 'archived' ? 'Restaurar' : 'Archivar'}</Button>
          <Button variant="ghost" icon={<GitMerge size={16} />} onClick={() => setMergeOpen(true)}>Fusionar</Button>
        </div>
      </Panel>

      {k.examples.length > 0 && (
        <Panel className="mt-4 p-5">
          <SectionTitle title="Ejemplos" />
          <ul className="space-y-2.5">
            {k.examples.map((ex, i) => (
              <li key={i} className="flex gap-2 rounded-2xl bg-surface-2 px-4 py-3">
                <div className="flex-1">
                  <p className="font-display text-[1.05rem] text-ink"><Highlighted text={ex.en} /></p>
                  {ex.es && <p className="text-sm text-muted">{ex.es}</p>}
                </div>
                <IconButton label="Escuchar" onClick={() => speak(stripCloze(ex.en))} className="h-8 w-8"><Volume2 size={16} /></IconButton>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-4"><KnowledgeDetails knowledge={k} sources={sources} defaultOpen /></div>

      <Panel className="mt-4 p-5">
        <SectionTitle title={`Tarjetas (${cards.length})`} subtitle="Cada tarjeta tiene su propia programación FSRS." action={<Button size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => setEditing('new-card')}>Tarjeta</Button>} />
        <ul className="space-y-2">
          {cards.map((c, i) => {
            const s = states[i];
            return (
              <li key={c.id} className={cx('rounded-2xl border border-line p-4', c.suspended && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={CARD_TYPE_LABELS[c.type].tone}>{CARD_TYPE_LABELS[c.type].label}</Chip>
                  <Chip>{STATE_LABELS[s?.state ?? 0]}</Chip>
                  {c.suspended && <Chip tone="amber">suspendida</Chip>}
                  {c.flagged && <Chip tone="coral" icon={<Flag size={11} />}>{c.flagged.reason}</Chip>}
                </div>
                <p className="mt-2 text-[15px] text-ink">{c.type === 'kwt' ? `${c.original} → ${c.prompt}` : c.prompt}</p>
                <p className="mt-1 text-sm font-semibold text-sage">{c.answer}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {s && s.state !== 0 ? `próxima: ${relativeDue(s.due)} · intervalo ${formatInterval(s.scheduledDays * 86_400_000)} · ${s.reps} repasos · ${s.lapses} fallos · dificultad ${s.difficulty.toFixed(1)}` : 'todavía no estudiada'}
                  </span>
                  <div className="flex gap-1">
                    <IconButton label="Editar tarjeta" onClick={() => setEditing(c)}><Pencil size={16} /></IconButton>
                    <IconButton label={c.suspended ? 'Reactivar' : 'Suspender'} onClick={() => void setCardSuspended(c.id, !c.suspended)}>{c.suspended ? <Play size={16} /> : <Pause size={16} />}</IconButton>
                    <IconButton label="Reiniciar (vuelve a nueva, conserva historial)" onClick={() => void resetCard(c.id).then(() => toast('Tarjeta reiniciada', 'info'))}><RotateCcw size={16} /></IconButton>
                    {c.flagged && <IconButton label="Quitar reporte" onClick={() => void flagCard(c.id, '')}><Flag size={16} /></IconButton>}
                    <IconButton label="Eliminar tarjeta" onClick={() => { if (confirm('¿Eliminar esta tarjeta? Su historial de repasos se conserva en las estadísticas.')) void deleteCard(c.id); }}><Trash2 size={16} /></IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="mt-4 mb-8 p-5">
        <SectionTitle title="Historial" subtitle={`${reviews.length} repasos · ${errors.length} errores registrados fuera de la app`} />
        {reviews.length === 0 && errors.length === 0 ? (
          <p className="text-sm text-muted">Sin repasos todavía.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {errors.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span className="text-coral">Fallo registrado{e.sourceTitle ? ` en «${e.sourceTitle}»` : ''}{e.wrongAnswer ? `: «${e.wrongAnswer}»` : ''}</span>
                <span className="shrink-0 text-muted">{formatDate(e.occurredAt)}</span>
              </li>
            ))}
            {reviews.slice(0, 60).map((r) => (
              <li key={r.id} className="flex justify-between gap-3 py-2">
                <span className="text-ink-2">
                  <span className={cx('font-semibold', r.rating === 1 ? 'text-coral' : r.rating === 2 ? 'text-amber' : r.rating === 3 ? 'text-sage' : r.rating === 4 ? 'text-lavender' : 'text-muted')}>{RATING_NAMES[r.rating]}</span>
                  {' · '}{CARD_TYPE_LABELS[cardById.get(r.cardId)?.type ?? 'es2en'].label}
                  {r.kind === 'cram' ? ' · intensivo' : r.kind === 'external' ? ' · fallo externo' : r.scheduledDaysAfter !== undefined ? ` · siguiente en ${formatInterval(new Date(r.dueAfter ?? r.reviewedAt).getTime() - new Date(r.reviewedAt).getTime())}` : ''}
                </span>
                <span className="shrink-0 text-muted">{new Date(r.reviewedAt).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={editing === 'knowledge'} onClose={() => setEditing(null)} title="Editar conocimiento" wide>
        <KnowledgeEditor knowledge={k} onDone={() => { setEditing(null); toast('Cambios guardados (el historial no se modificó)'); }} />
      </Modal>
      <Modal open={!!editing && typeof editing === 'object'} onClose={() => setEditing(null)} title="Editar tarjeta" wide>
        {editing && typeof editing === 'object' && <CardEditor card={editing} knowledgeId={k.id} onDone={() => { setEditing(null); toast('Tarjeta guardada'); }} />}
      </Modal>
      <Modal open={editing === 'new-card'} onClose={() => setEditing(null)} title="Nueva tarjeta" wide>
        <CardEditor knowledgeId={k.id} onDone={() => { setEditing(null); toast('Tarjeta agregada'); }} />
      </Modal>
      <MergeDialog open={mergeOpen} onClose={() => setMergeOpen(false)} targetId={k.id} onMerged={(otherExpr) => toast(`«${otherExpr}» se fusionó aquí con todas sus tarjetas e historial`)} />
      <MissDialog open={missOpen} onClose={() => setMissOpen(false)} knowledgeId={k.id} onDone={() => toast('Recurrencia registrada: prioridad alta')} />
    </div>
  );
}

function MergeDialog({ open, onClose, targetId, onMerged }: { open: boolean; onClose: () => void; targetId: string; onMerged: (expr: string) => void }) {
  const [q, setQ] = useState('');
  const results = useLiveQuery(async () => {
    if (q.trim().length < 2) return [];
    const n = normalizeExpression(q);
    return (await db.knowledge.toArray()).filter((k) => !k.deleted && k.id !== targetId && (normalizeExpression(k.expression).includes(n) || k.meaningEs.toLowerCase().includes(q.toLowerCase()))).slice(0, 12);
  }, [q, targetId]);
  return (
    <Modal open={open} onClose={onClose} title="Fusionar un duplicado aquí">
      <p className="mb-3 text-sm text-muted">El conocimiento elegido se integra en este: se mueven sus tarjetas con todo su historial y se conservan sus fuentes, ejemplos y errores.</p>
      <input className={inputClass} placeholder="Buscar el duplicado…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="mt-3 space-y-1">
        {results?.map((k) => (
          <li key={k.id}>
            <button type="button" className="w-full rounded-xl px-3 py-2 text-left hover:bg-surface-2" onClick={async () => { if (confirm(`¿Fusionar «${k.expression}» dentro de este conocimiento?`)) { await mergeKnowledge(targetId, k.id); onMerged(k.expression); onClose(); } }}>
              <span className="font-display text-ink">{k.expression}</span> <span className="text-sm text-muted">— {k.meaningEs}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function MissDialog({ open, onClose, knowledgeId, onDone }: { open: boolean; onClose: () => void; knowledgeId: string; onDone: () => void }) {
  const [wrong, setWrong] = useState('');
  const [src, setSrc] = useState('');
  const [lapse, setLapse] = useState(true);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar que lo volviste a fallar"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={async () => { await logRecurrence(knowledgeId, { wrongAnswer: wrong.trim() || undefined, sourceTitle: src.trim() || undefined, asLapse: lapse }); setWrong(''); setSrc(''); onClose(); onDone(); }}>Registrar</Button></>}
    >
      <div className="space-y-3">
        <Field label="¿Qué escribiste? (opcional)"><input className={inputClass} value={wrong} onChange={(e) => setWrong(e.target.value)} /></Field>
        <Field label="¿Dónde? (opcional)"><input className={inputClass} value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Mock Exam 2 · KWT 5" /></Field>
        <Toggle checked={lapse} onChange={setLapse} label="Contarlo como «Again» en sus tarjetas" description="FSRS las vuelve a programar pronto. El historial anterior se conserva." />
      </div>
    </Modal>
  );
}

