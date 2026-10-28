import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Flag, Keyboard, Lightbulb, MoreHorizontal, PartyPopper, Pencil, RotateCcw, Star, Timer, Undo2, Volume2, X,
} from 'lucide-react';
import { db } from '../lib/db';
import { buildCramQueue, buildScheduledQueue, loadLibrary, type Library, type QueueItem, type SessionMode } from '../lib/queue';
import { getScheduler, flagCard, recordReview, resetCard, setCardSuspended, toggleFavorite, undoReview, type RecordReviewResult, getSettings } from '../lib/repo';
import { previewIntervals, RATING_LABELS, type Grade } from '../lib/scheduler';
import { speak, stopSpeaking } from '../lib/speech';
import type { Card, CardState, DeckFilter, Knowledge, Settings, Source } from '../lib/types';
import { useSettings } from '../lib/hooks';
import { CardBack, CardFront } from '../components/StudyCard';
import { Button, Chip, cx, IconButton, inputClass, Kbd, Modal, Panel } from '../components/ui';
import { CardEditor, KnowledgeEditor } from '../components/editors';
import { useToast } from '../components/toast';
import { formatInterval } from '../lib/util';
import type { FSRS } from 'ts-fsrs';

interface Pending {
  item: QueueItem;
  dueAt: number;
}

const RATING_STYLES: Record<Grade, string> = {
  1: 'bg-coral-soft text-coral border-coral/25',
  2: 'bg-amber-soft text-amber border-amber/25',
  3: 'bg-sage-soft text-sage border-sage/30',
  4: 'bg-lavender-soft text-lavender border-lavender/30',
};

function parseFilter(params: URLSearchParams, decks: Map<string, DeckFilter>): DeckFilter | undefined {
  const deck = params.get('deck');
  if (deck && decks.has(deck)) return decks.get(deck);
  const parts = params.get('parts');
  const cats = params.get('cats');
  const tags = params.get('tags');
  const knowledge = params.get('knowledge');
  if (!parts && !cats && !tags && !knowledge) return undefined;
  return {
    parts: parts ? (parts.split(',') as DeckFilter['parts']) : undefined,
    categories: cats ? (cats.split(',') as DeckFilter['categories']) : undefined,
    tags: tags ? tags.split(',') : undefined,
    knowledgeIds: knowledge ? knowledge.split(',') : undefined,
  };
}

export default function StudySession() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const liveSettings = useSettings();
  const mode = (params.get('mode') ?? 'scheduled') as SessionMode;
  const examMode = params.get('exam') === '1';
  const quick = params.get('quick') === '1';
  const isCram = mode !== 'scheduled';

  const [lib, setLib] = useState<Library | null>(null);
  const [sources, setSources] = useState<Map<string, Source>>(new Map());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [f, setF] = useState<FSRS | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typing, setTyping] = useState(() => { try { return localStorage.getItem('c2r-typing') === '1'; } catch { return false; } });
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<{ cardId: string; knowledgeId: string; rating: Grade }[]>([]);
  const [lastAction, setLastAction] = useState<{ result: RecordReviewResult; item: QueueItem; queue: QueueItem[]; pending: Pending[] } | null>(null);
  const [finished, setFinished] = useState(false);
  const [waitingUntil, setWaitingUntil] = useState<number | null>(null);
  const [editing, setEditing] = useState<'card' | 'knowledge' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const cramAgainCount = useRef(new Map<string, number>());
  const startedAt = useRef(Date.now());
  const answerRef = useRef<HTMLDivElement>(null);

  // Al revelar, si la respuesta quedó debajo del pliegue (iPhone), se desplaza suavemente hasta ella.
  useEffect(() => {
    if (!revealed) return;
    const id = requestAnimationFrame(() => {
      const el = answerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.5) window.scrollBy({ top: top - window.innerHeight * 0.22, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [revealed, current]);

  // Carga inicial: biblioteca en memoria + cola de la sesión.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [library, s, srcs, decks] = await Promise.all([loadLibrary(), getSettings(), db.sources.toArray(), db.decks.toArray()]);
      const filter = parseFilter(params, new Map(decks.map((d) => [d.id, d.filter])));
      const size = Number(params.get('size')) || (quick ? 15 : 30);
      let items: QueueItem[];
      if (isCram) items = await buildCramQueue({ settings: s, mode, filter, size }, library);
      else items = (await buildScheduledQueue({ settings: s, filter, maxCards: quick ? 20 : undefined, extraNew: Number(params.get('extraNew')) || 0 }, library)).items;
      if (!alive) return;
      setLib(library);
      setSettings(s);
      setF(await getScheduler());
      setSources(new Map(srcs.map((x) => [x.id, x])));
      setTotal(items.length);
      const [first, ...rest] = items;
      setCurrent(first ?? null);
      setQueue(rest);
      if (!first) setFinished(true);
      shownAt.current = Date.now();
    })();
    return () => { alive = false; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card: Card | undefined = current ? lib?.cards.find((c) => c.id === current.cardId) : undefined;
  const knowledge: Knowledge | undefined = current ? lib?.knowledge.get(current.knowledgeId) : undefined;
  const state: CardState | undefined = current ? lib?.states.get(current.cardId) : undefined;

  const previews = useMemo(() => {
    if (!f || !current || isCram) return null;
    const st = state ?? { cardId: current.cardId, knowledgeId: current.knowledgeId, due: new Date(0).toISOString(), stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, state: 0 as const };
    return previewIntervals(st, new Date(), f);
  }, [f, current, state, isCram, revealed]);

  const say = useCallback((text: string) => speak(text, { rate: liveSettings.speechRate, voiceURI: liveSettings.voiceURI }), [liveSettings.speechRate, liveSettings.voiceURI]);

  const reveal = useCallback(() => {
    if (!card || revealed) return;
    setRevealed(true);
    if (liveSettings.autoSpeak) say(card.type === 'es2en' || card.type === 'prod' ? card.answer : card.answer);
  }, [card, revealed, liveSettings.autoSpeak, say]);

  const advance = useCallback((q: QueueItem[], p: Pending[]) => {
    const now = Date.now();
    const readyIdx = p.findIndex((x) => x.dueAt <= now);
    let next: QueueItem | null = null;
    let nq = q;
    let np = p;
    if (readyIdx >= 0) {
      next = p[readyIdx].item;
      np = p.filter((_, i) => i !== readyIdx);
    } else if (q.length) {
      [next, ...nq] = q;
    } else if (p.length) {
      const soonest = p.reduce((a, b) => (a.dueAt < b.dueAt ? a : b));
      setQueue([]);
      setPending(p);
      setCurrent(null);
      setWaitingUntil(soonest.dueAt);
      return;
    }
    setQueue(nq);
    setPending(np);
    setCurrent(next);
    setWaitingUntil(null);
    setRevealed(false);
    setShowHint(liveSettings.showHintsByDefault && !examMode);
    setTyped('');
    shownAt.current = Date.now();
    window.scrollTo({ top: 0 });
    if (!next) setFinished(true);
  }, [liveSettings.showHintsByDefault, examMode]);

  const rate = useCallback(async (rating: Grade) => {
    if (!card || !current || !revealed || busy || !lib || !settings) return;
    setBusy(true);
    try {
      const durationMs = Date.now() - shownAt.current;
      const result = await recordReview({ card, rating, durationMs, kind: isCram ? 'cram' : 'review' });
      setLastAction({ result, item: current, queue, pending });
      lib.states.set(card.id, result.after);
      setResults((r) => [...r, { cardId: card.id, knowledgeId: card.knowledgeId, rating }]);
      setDone((d) => d + 1);
      let p = pending;
      let q = queue;
      if (!isCram) {
        const due = new Date(result.after.due).getTime();
        // Tarjetas en aprendizaje/reaprendizaje: vuelven dentro de la misma sesión.
        if ((result.after.state === 1 || result.after.state === 3) && due - Date.now() < 60 * 60_000) {
          p = [...pending, { item: { ...current, kind: 'learning' }, dueAt: due }];
          setTotal((t) => t + 1);
        }
      } else if (rating === 1) {
        const n = cramAgainCount.current.get(card.id) ?? 0;
        if (n < 2) {
          cramAgainCount.current.set(card.id, n + 1);
          const pos = Math.min(q.length, 3 + Math.floor(Math.random() * 3));
          q = [...q.slice(0, pos), current, ...q.slice(pos)];
          setTotal((t) => t + 1);
        }
      }
      advance(q, p);
    } catch (e) {
      toast(`No se pudo guardar el repaso: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [card, current, revealed, busy, lib, settings, isCram, queue, pending, advance, toast]);

  const undo = useCallback(async () => {
    if (!lastAction || !lib) return;
    await undoReview(lastAction.result);
    lib.states.set(lastAction.result.before.cardId, lastAction.result.before);
    setResults((r) => r.slice(0, -1));
    setDone((d) => Math.max(0, d - 1));
    setQueue(lastAction.queue);
    setPending(lastAction.pending);
    setCurrent(lastAction.item);
    setRevealed(true);
    setFinished(false);
    setWaitingUntil(null);
    setLastAction(null);
    toast('Repaso deshecho', 'info');
  }, [lastAction, lib, toast]);

  // Espera de tarjetas en aprendizaje.
  useEffect(() => {
    if (!waitingUntil) return;
    const t = setInterval(() => {
      if (Date.now() >= waitingUntil) advance(queue, pending);
    }, 1000);
    return () => clearInterval(t);
  }, [waitingUntil, queue, pending, advance]);

  // Atajos de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || reportOpen) return;
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (inInput && e.key !== 'Enter' && e.key !== 'Escape') return;
      if (e.key === 'Escape') { navigate(-1); return; }
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) { e.preventDefault(); reveal(); return; }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); void rate(Number(e.key) as Grade); return; }
      if (revealed && (e.key === ' ' || e.key === 'Enter') && !inInput) { e.preventDefault(); void rate(3); return; }
      if (inInput) return;
      const k = e.key.toLowerCase();
      if (k === 'z' || (k === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); void undo(); }
      else if (k === 'h') setShowHint((x) => !x);
      else if (k === 'p' || k === 'v') { if (card) say(revealed ? card.answer : card.type === 'es2en' || card.type === 'prod' ? '' : card.prompt); }
      else if (k === 'e') setEditing('card');
      else if (k === 'f' && knowledge) void toggleFavorite(knowledge.id).then((fav) => { knowledge.favorite = fav; toast(fav ? 'Marcada como favorita' : 'Quitada de favoritas', 'info'); });
      else if (k === 't') setTyping((x) => !x);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, reveal, rate, undo, editing, reportOpen, card, knowledge, say, navigate, toast]);

  useEffect(() => { try { localStorage.setItem('c2r-typing', typing ? '1' : '0'); } catch { /* sin almacenamiento */ } }, [typing]);

  async function reloadCurrent() {
    if (!lib || !current) return;
    const [c, k] = await Promise.all([db.cards.get(current.cardId), db.knowledge.get(current.knowledgeId)]);
    if (c) lib.cards = lib.cards.map((x) => (x.id === c.id ? c : x));
    if (k) lib.knowledge.set(k.id, k);
    setLib({ ...lib });
  }

  const progress = total ? done / (done + queue.length + pending.length + (current ? 1 : 0)) : 0;
  const remaining = { new: 0, learning: pending.length, review: 0 };
  for (const q of [current, ...queue]) {
    if (!q) continue;
    if (q.kind === 'new') remaining.new++;
    else if (q.kind === 'learning') remaining.learning++;
    else remaining.review++;
  }

  if (finished) return <SessionSummary results={results} isCram={isCram} elapsedMs={Date.now() - startedAt.current} lib={lib} onAgain={(ids) => navigate(`/study/session?mode=custom&knowledge=${ids.join(',')}&size=${ids.length}`, { replace: true })} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-3 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-6">
      {/* Barra superior */}
      <div className="flex items-center gap-2 py-2">
        <IconButton label="Salir de la sesión" onClick={() => navigate(-1)}><X size={22} /></IconButton>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gradient-to-r from-lavender to-sage" style={{ width: `${Math.round(progress * 100)}%`, transition: 'width 0.5s cubic-bezier(0.2,0.7,0.2,1)' }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-medium tabular-nums text-muted">
            <span>{isCram ? (mode === 'errors' ? 'Repaso intensivo de errores' : 'Sesión personalizada') : examMode ? 'Modo examen' : quick ? 'Repaso rápido' : 'Sesión del día'}</span>
            {isCram ? <span>{done}/{total}</span> : (
              <span className="flex gap-2">
                <span className="text-sky">{remaining.new}</span>
                <span className="text-coral">{remaining.learning}</span>
                <span className="text-sage">{remaining.review}</span>
              </span>
            )}
          </div>
        </div>
        <IconButton label="Deshacer último repaso (Z)" onClick={() => void undo()} disabled={!lastAction}><Undo2 size={20} /></IconButton>
        <div className="relative">
          <IconButton label="Más acciones" onClick={() => setMenuOpen((x) => !x)} disabled={!card}><MoreHorizontal size={22} /></IconButton>
          {menuOpen && card && knowledge && (
            <div className="absolute right-0 top-11 z-30 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-lifted anim-pop" onMouseLeave={() => setMenuOpen(false)}>
              <MenuItem icon={<Pencil size={16} />} label="Editar tarjeta" onClick={() => { setEditing('card'); setMenuOpen(false); }} />
              <MenuItem icon={<Pencil size={16} />} label="Editar conocimiento" onClick={() => { setEditing('knowledge'); setMenuOpen(false); }} />
              <MenuItem icon={<Flag size={16} />} label="Reportar problema" onClick={() => { setReportOpen(true); setMenuOpen(false); }} />
              <MenuItem icon={<Keyboard size={16} />} label={typing ? 'No escribir respuesta' : 'Escribir mi respuesta'} onClick={() => { setTyping((x) => !x); setMenuOpen(false); }} />
              <MenuItem icon={<RotateCcw size={16} />} label="Reiniciar tarjeta (nueva)" onClick={async () => { await resetCard(card.id); setMenuOpen(false); toast('Tarjeta reiniciada: su historial se conserva', 'info'); advance(queue, pending); }} />
              <MenuItem icon={<Timer size={16} />} label="Suspender tarjeta" onClick={async () => { await setCardSuspended(card.id, true); setMenuOpen(false); toast('Tarjeta suspendida', 'info'); advance(queue, pending); }} />
              <MenuItem icon={<ArrowLeft size={16} />} label="Ver en la biblioteca" onClick={() => navigate(`/library/${encodeURIComponent(knowledge.id)}`)} />
            </div>
          )}
        </div>
      </div>

      {/* Tarjeta */}
      <div className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+150px)] pt-2">
        {waitingUntil && !current ? (
          <Panel className="mt-10 p-8 text-center anim-rise">
            <Timer className="mx-auto text-lavender" size={34} />
            <h2 className="mt-3 font-display text-2xl">Pausa breve</h2>
            <p className="mt-2 text-muted">Las tarjetas que estás aprendiendo vuelven en {formatInterval(waitingUntil - Date.now())}. Repetirlas tras un pequeño intervalo ayuda a fijarlas.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="primary" onClick={() => { const p = pending.map((x) => ({ ...x, dueAt: 0 })); advance(queue, p); }}>Repasarlas ya</Button>
              <Button onClick={() => setFinished(true)}>Terminar sesión</Button>
            </div>
          </Panel>
        ) : card && knowledge ? (
          <Panel as="article" className="relative flex-1 p-5 sm:p-8" key={card.id}>
            <div className="absolute right-3 top-3 flex gap-1">
              {(card.type !== 'es2en' && card.type !== 'prod') || revealed ? (
                <IconButton label="Escuchar (P)" onClick={() => say(revealed ? card.answer : card.prompt.replace(/_{4}/g, 'blank'))}><Volume2 size={19} /></IconButton>
              ) : null}
              <IconButton label="Favorita (F)" onClick={() => void toggleFavorite(knowledge.id).then((fav) => { knowledge.favorite = fav; setLib({ ...lib! }); })}>
                <Star size={19} className={knowledge.favorite ? 'fill-amber text-amber' : ''} />
              </IconButton>
            </div>
            <div className={cx('pr-16', !revealed && 'anim-rise')}>
              <CardFront card={card} knowledge={knowledge} showHint={showHint} examMode={examMode} compact={revealed} />
            </div>
            {typing && !revealed && (
              <input
                autoFocus
                className={cx(inputClass, 'mt-5')}
                placeholder="Escribí tu respuesta y presioná Enter"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            )}
            {revealed && (
              <div ref={answerRef} className="mt-5 scroll-mt-4 border-t border-dashed border-line pt-5">
                <CardBack card={card} knowledge={knowledge} revealed onSpeak={say} sources={sources} quick={quick} typed={typing ? typed : undefined} examMode={examMode} />
              </div>
            )}
            {state && !isCram && revealed && (
              <p className="mt-4 text-center text-[11px] text-faint">
                {state.reps} repasos · {state.lapses} fallos · dificultad {state.state === 0 ? '—' : state.difficulty.toFixed(1)} · estabilidad {state.state === 0 ? '—' : `${state.stability.toFixed(1)} d`}
              </p>
            )}
          </Panel>
        ) : (
          <div className="skeleton mt-4 h-72 rounded-3xl" />
        )}
      </div>

      {/* Controles inferiores, cómodos para una mano */}
      {card && !waitingUntil && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 px-3 pt-3 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="mx-auto max-w-3xl">
            {!revealed ? (
              <div className="flex gap-2">
                {!examMode && (card.hint || knowledge?.hint) && (
                  <Button size="lg" variant="secondary" onClick={() => setShowHint((x) => !x)} aria-pressed={showHint} icon={<Lightbulb size={19} />} className="shrink-0">
                    <span className="hidden sm:inline">Pista</span>
                  </Button>
                )}
                <Button size="lg" variant="primary" block onClick={reveal}>
                  Mostrar respuesta <span className="ml-2 hidden opacity-70 sm:inline"><Kbd>Espacio</Kbd></span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as Grade[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => void rate(r)}
                    className={cx('flex h-[64px] flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50', RATING_STYLES[r])}
                  >
                    <span>{RATING_LABELS[r].label}</span>
                    <span className="text-[11px] font-medium opacity-80">
                      {isCram ? RATING_LABELS[r].es : previews?.find((p) => p.rating === r)?.label}
                    </span>
                    <span className="hidden text-[10px] opacity-60 sm:block">{r}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 hidden justify-center gap-3 text-[11px] text-muted lg:flex">
              <span><Kbd>Espacio</Kbd> mostrar / Good</span><span><Kbd>1</Kbd>–<Kbd>4</Kbd> calificar</span><span><Kbd>H</Kbd> pista</span><span><Kbd>P</Kbd> audio</span><span><Kbd>Z</Kbd> deshacer</span><span><Kbd>E</Kbd> editar</span><span><Kbd>F</Kbd> favorita</span><span><Kbd>T</Kbd> escribir</span>
            </div>
          </div>
        </div>
      )}

      <Modal open={editing === 'card' && !!card} onClose={() => setEditing(null)} title="Editar tarjeta" wide>
        {card && <CardEditor card={card} knowledgeId={card.knowledgeId} onDone={() => { setEditing(null); void reloadCurrent(); toast('Tarjeta actualizada'); }} />}
      </Modal>
      <Modal open={editing === 'knowledge' && !!knowledge} onClose={() => setEditing(null)} title="Editar conocimiento" wide>
        {knowledge && <KnowledgeEditor knowledge={knowledge} onDone={() => { setEditing(null); void reloadCurrent(); toast('Conocimiento actualizado'); }} />}
      </Modal>
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Reportar tarjeta"
        footer={<><Button onClick={() => setReportOpen(false)}>Cancelar</Button><Button variant="primary" onClick={async () => { if (card) await flagCard(card.id, reportText || 'Revisar'); setReportOpen(false); setReportText(''); toast('Tarjeta marcada para revisar'); }}>Reportar</Button></>}
      >
        <p className="mb-3 text-sm text-muted">La tarjeta queda marcada en la biblioteca para que la corrijas (o se la pases a Claude).</p>
        <textarea className={cx(inputClass, 'min-h-[100px]')} placeholder="¿Qué está mal? (respuesta dudosa, traducción poco natural, el frente revela la respuesta…)" value={reportText} onChange={(e) => setReportText(e.target.value)} />
      </Modal>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink-2 transition hover:bg-surface-2">
      <span className="text-muted">{icon}</span>{label}
    </button>
  );
}

function SessionSummary({ results, isCram, elapsedMs, lib, onAgain }: { results: { cardId: string; knowledgeId: string; rating: Grade }[]; isCram: boolean; elapsedMs: number; lib: Library | null; onAgain: (knowledgeIds: string[]) => void }) {
  const navigate = useNavigate();
  const total = results.length;
  const correct = results.filter((r) => r.rating > 1).length;
  const failedIds = Array.from(new Set(results.filter((r) => r.rating === 1).map((r) => r.knowledgeId)));
  const failed = failedIds.map((id) => lib?.knowledge.get(id)).filter(Boolean) as Knowledge[];
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <Panel className="p-8 text-center anim-pop">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sage-soft text-sage"><PartyPopper size={30} /></div>
        <h1 className="mt-4 font-display text-3xl">{total ? '¡Sesión completada!' : 'Nada pendiente por ahora'}</h1>
        <p className="mt-2 text-muted">
          {total
            ? `${total} repasos · ${Math.round((correct / total) * 100)}% recordadas · ${Math.max(1, Math.round(elapsedMs / 60000))} min`
            : 'No hay tarjetas para esta selección. Volvé más tarde o elegí otra sesión.'}
        </p>
        {isCram && total > 0 && <p className="mt-1 text-xs text-muted">El repaso intensivo no modifica la programación FSRS.</p>}
        {failed.length > 0 && (
          <div className="mt-6 text-left">
            <p className="mb-2 text-sm font-semibold text-ink-2">Te costaron:</p>
            <div className="flex flex-wrap gap-1.5">{failed.slice(0, 12).map((k) => <Chip key={k.id} tone="coral">{k.expression}</Chip>)}</div>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" size="lg" onClick={() => navigate('/', { replace: true })}>Volver al inicio</Button>
          {failed.length > 0 && <Button size="lg" onClick={() => onAgain(failedIds)}>Repasar las falladas</Button>}
          {!total && <Button size="lg" onClick={() => navigate('/study', { replace: true })}>Elegir otra sesión</Button>}
        </div>
      </Panel>
    </div>
  );
}
