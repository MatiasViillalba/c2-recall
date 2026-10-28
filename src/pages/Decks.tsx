import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Layers, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { useSettings } from '../lib/hooks';
import { buildScheduledQueue, loadLibrary, matchesFilter, todayStats } from '../lib/queue';
import { CATEGORY_LABELS, PART_LABELS } from '../lib/labels';
import { CATEGORIES, EXAM_PARTS, type Category, type Deck, type DeckFilter, type ExamPart } from '../lib/types';
import { enqueue } from '../lib/repo';
import { Button, Chip, cx, Field, IconButton, inputClass, Modal, PageHeader, Panel, Toggle } from '../components/ui';
import { useToast } from '../components/toast';
import { nowIso, uuid } from '../lib/util';

const COLORS: Record<string, string> = {
  coral: 'bg-coral-soft text-coral', indigo: 'bg-primary-soft text-primary', lavender: 'bg-lavender-soft text-lavender', sky: 'bg-sky-soft text-sky',
  sage: 'bg-sage-soft text-sage', amber: 'bg-amber-soft text-amber', rose: 'bg-coral-soft text-coral', teal: 'bg-sage-soft text-sage', slate: 'bg-surface-3 text-ink-2',
};

export default function Decks() {
  const settings = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState<Deck | 'new' | null>(null);
  const data = useLiveQuery(async () => {
    const decks = (await db.decks.toArray()).filter((d) => !d.deleted);
    const lib = await loadLibrary();
    const today = await todayStats(settings);
    const rows = [];
    for (const d of decks) {
      let total = 0;
      for (const k of lib.knowledge.values()) if (k.status !== 'archived' && matchesFilter(k, undefined, d.filter)) total++;
      const q = await buildScheduledQueue({ settings, filter: d.filter }, lib, today);
      rows.push({ deck: d, total, due: q.counts.review + q.counts.learning, fresh: q.counts.new });
    }
    // Personalizados primero, después los predefinidos en su orden.
    return rows.sort((a, b) => Number(a.deck.builtIn) - Number(b.deck.builtIn));
  }, [settings.newPerDay, settings.reviewsPerDay]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-8 lg:pt-10">
      <PageHeader
        eyebrow="Mazos"
        title="Mazos"
        subtitle="Son filtros combinables: una misma expresión puede estar en varios mazos sin duplicarse."
        actions={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing('new')}>Nuevo mazo</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
        {data?.map(({ deck, total, due, fresh }) => (
          <Panel key={deck.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <span className={cx('flex h-10 w-10 items-center justify-center rounded-2xl', COLORS[deck.color ?? 'lavender'] ?? COLORS.lavender)}><Layers size={19} /></span>
              {!deck.builtIn && (
                <div className="flex">
                  <IconButton label="Editar mazo" onClick={() => setEditing(deck)}><Pencil size={16} /></IconButton>
                  <IconButton label="Eliminar mazo" onClick={async () => { if (confirm(`¿Eliminar el mazo «${deck.name}»? Las tarjetas no se borran.`)) { await db.decks.put({ ...deck, deleted: true, updatedAt: nowIso() }); await enqueue('decks', [deck.id]); toast('Mazo eliminado', 'info'); } }}><Trash2 size={16} /></IconButton>
                </div>
              )}
            </div>
            <h3 className="mt-3 font-display text-lg leading-tight text-ink">{deck.name}</h3>
            {deck.description && <p className="mt-1 text-sm text-muted">{deck.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>{total} conocimientos</Chip>
              {due > 0 && <Chip tone="coral">{due} vencidas</Chip>}
              {fresh > 0 && <Chip tone="sky">{fresh} nuevas hoy</Chip>}
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Button size="sm" variant="primary" icon={<Sparkles size={15} />} disabled={!due && !fresh} onClick={() => navigate(`/study/session?mode=scheduled&deck=${deck.id}`)}>Estudiar</Button>
              <Button size="sm" onClick={() => navigate(`/study/session?mode=custom&deck=${deck.id}&size=25`)}>Repaso libre</Button>
            </div>
          </Panel>
        ))}
      </div>
      <DeckEditor deck={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast('Mazo guardado'); }} />
    </div>
  );
}

function DeckEditor({ deck, onClose, onSaved }: { deck: Deck | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = deck && deck !== 'new' ? deck : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<DeckFilter>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = existing?.id ?? (deck === 'new' ? 'new' : null);
  if (key && loadedFor !== key) {
    setLoadedFor(key);
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setFilter(existing?.filter ?? {});
  }
  const toggle = <T,>(arr: T[] | undefined, v: T) => ((arr ?? []).includes(v) ? (arr ?? []).filter((x) => x !== v) : [...(arr ?? []), v]);

  async function save() {
    if (!name.trim()) return;
    const now = nowIso();
    const d: Deck = { id: existing?.id ?? `deck-${uuid().slice(0, 8)}`, name: name.trim(), description: description.trim() || undefined, filter, builtIn: false, color: existing?.color ?? 'lavender', createdAt: existing?.createdAt ?? now, updatedAt: now };
    await db.decks.put(d);
    await enqueue('decks', [d.id]);
    setLoadedFor(null);
    onSaved();
  }

  return (
    <Modal open={!!deck} onClose={() => { setLoadedFor(null); onClose(); }} title={existing ? 'Editar mazo' : 'Nuevo mazo'} wide footer={<Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>Guardar</Button>}>
      <div className="space-y-4">
        <Field label="Nombre"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mock Exam 3" /></Field>
        <Field label="Descripción"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Partes del examen">
          <div className="flex flex-wrap gap-1.5">
            {EXAM_PARTS.map((p) => <Pill key={p} on={!!filter.parts?.includes(p)} onClick={() => setFilter((f) => ({ ...f, parts: toggle(f.parts, p as ExamPart) }))}>{PART_LABELS[p].short}</Pill>)}
          </div>
        </Field>
        <Field label="Categorías">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => <Pill key={c} on={!!filter.categories?.includes(c)} onClick={() => setFilter((f) => ({ ...f, categories: toggle(f.categories, c as Category) }))}>{CATEGORY_LABELS[c]}</Pill>)}
          </div>
        </Field>
        <Field label="Etiquetas (separadas por coma)" hint="Por ejemplo, el nombre de un simulacro que usaste al importar: mock-3">
          <input className={inputClass} value={(filter.tags ?? []).join(', ')} onChange={(e) => setFilter((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))} />
        </Field>
        <div className="divide-y divide-line rounded-2xl border border-line px-4">
          <Toggle checked={filter.match === 'all'} onChange={(v) => setFilter((f) => ({ ...f, match: v ? 'all' : 'any' }))} label="Exigir todos los criterios" description="Desactivado: alcanza con cumplir uno (parte, categoría o etiqueta)." />
          <Toggle checked={!!filter.errorsOnly} onChange={(v) => setFilter((f) => ({ ...f, errorsOnly: v }))} label="Solo mis errores" />
          <Toggle checked={!!filter.favoritesOnly} onChange={(v) => setFilter((f) => ({ ...f, favoritesOnly: v }))} label="Solo favoritas" />
          <Toggle checked={!!filter.difficultOnly} onChange={(v) => setFilter((f) => ({ ...f, difficultOnly: v }))} label="Solo difíciles" />
        </div>
      </div>
    </Modal>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cx('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-primary bg-primary text-primary-ink' : 'border-line text-ink-2')}>{children}</button>;
}
