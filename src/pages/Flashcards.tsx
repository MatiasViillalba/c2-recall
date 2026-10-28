import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Undo2 } from 'lucide-react';
import { loadLibrary, todayStats, type Library, type TodayStats } from '../lib/queue';
import { categoryOf, deckSnapshot, markedSegments, splitFront, type DeckSnapshot } from '../lib/practice';
import { recordReview, undoReview, type RecordReviewResult } from '../lib/repo';
import { makeScheduler, newCardState, previewIntervals, type Grade } from '../lib/scheduler';
import { useSettings } from '../lib/hooks';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';
import type { Card, Knowledge } from '../lib/types';

const RATINGS: { grade: Grade; label: string; key: string; tone: string }[] = [
  { grade: 1, label: 'Again', key: '1', tone: 'again' },
  { grade: 2, label: 'Hard', key: '2', tone: 'hard' },
  { grade: 3, label: 'Good', key: '3', tone: 'good' },
  { grade: 4, label: 'Easy', key: '4', tone: 'easy' },
];

export default function Flashcards() {
  const settings = useSettings();
  const [lib, setLib] = useState<Library | null>(null);
  const [today, setToday] = useState<TodayStats | null>(null);
  const [snap, setSnap] = useState<DeckSnapshot | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [extraNew, setExtraNew] = useState(0);
  const [last, setLast] = useState<{ result: RecordReviewResult; card: Card } | null>(null);
  const shownAt = useRef(Date.now());
  const busy = useRef(false);

  const refresh = useCallback((l: Library, t: TodayStats, opts: { lastCardId?: string; extra?: number } = {}) => {
    setSnap(deckSnapshot(l, settings, t, { lastCardId: opts.lastCardId, extraNew: opts.extra ?? extraNew }));
    setFlipped(false);
    shownAt.current = Date.now();
  }, [settings, extraNew]);

  // Carga inicial y al volver a la app (puede haber repasos sincronizados desde el otro dispositivo).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [l, t] = await Promise.all([loadLibrary(), todayStats(settings)]);
      if (!alive) return;
      setLib(l);
      setToday(t);
      refresh(l, t);
    };
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.newPerDay, settings.reviewsPerDay, settings.dayStartsAtHour]);

  // Las tarjetas en aprendizaje vencen solas: si no hay nada en pantalla, se revisa cada 15 s.
  useEffect(() => {
    if (!lib || !today || snap?.next) return;
    const id = setInterval(() => refresh(lib, today), 15_000);
    return () => clearInterval(id);
  }, [lib, today, snap?.next, refresh]);

  const card = snap?.next ?? null;
  const knowledge = card && lib ? lib.knowledge.get(card.knowledgeId) : undefined;
  const scheduler = useMemo(() => makeScheduler(settings), [settings]);
  const intervals = useMemo(() => {
    if (!card || !lib || !flipped) return null;
    const state = lib.states.get(card.id) ?? newCardState(card.id, card.knowledgeId);
    return previewIntervals(state, new Date(), scheduler);
  }, [card, lib, flipped, scheduler]);

  const rate = useCallback(async (grade: Grade) => {
    if (!card || !lib || !today || !flipped || busy.current) return;
    busy.current = true;
    try {
      const result = await recordReview({ card, rating: grade, durationMs: Date.now() - shownAt.current });
      lib.states.set(card.id, result.after);
      const t = {
        ...today,
        totalDone: today.totalDone + 1,
        newDone: today.newDone + (result.before.state === 0 ? 1 : 0),
        reviewsDone: today.reviewsDone + (result.before.state === 2 ? 1 : 0),
      };
      setToday(t);
      setLast({ result, card });
      refresh(lib, t, { lastCardId: card.id });
    } finally {
      busy.current = false;
    }
  }, [card, lib, today, flipped, refresh]);

  const undo = useCallback(async () => {
    if (!last || !lib || !today) return;
    await undoReview(last.result);
    lib.states.set(last.card.id, last.result.before);
    const t = {
      ...today,
      totalDone: Math.max(0, today.totalDone - 1),
      newDone: Math.max(0, today.newDone - (last.result.before.state === 0 ? 1 : 0)),
      reviewsDone: Math.max(0, today.reviewsDone - (last.result.before.state === 2 ? 1 : 0)),
    };
    setToday(t);
    setLast(null);
    setSnap((s) => (s ? { ...deckSnapshot(lib, settings, t, { extraNew }), next: last.card } : s));
    setFlipped(true);
  }, [last, lib, today, settings, extraNew]);

  // Teclado (notebook): espacio/enter dan vuelta y después = Good · 1–4 califican · Z deshace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        else void rate(3);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        void rate(Number(e.key) as Grade);
      } else if (e.key.toLowerCase() === 'z') {
        void undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, rate, undo]);

  return (
    <div className="study-page">
      <div className="ambient" aria-hidden><span /><span /><span /></div>
      <header className="study-header">
        <Logo />
        {snap && (
          <div className="flex items-center gap-1.5">
            {last && (
              <button type="button" onClick={() => void undo()} aria-label="Undo" className="undo-btn">
                <Undo2 size={17} strokeWidth={2.2} />
              </button>
            )}
            <div className="counts" aria-label="Cards left today">
              <span className="count count-new" title="New">{snap.counts.new}</span>
              <span className="count count-learn" title="Learning">{snap.counts.learning}</span>
              <span className="count count-review" title="To review">{snap.counts.review}</span>
            </div>
          </div>
        )}
      </header>

      <main className="study-main">
        {!snap && <div className="flash-card skeleton-card" />}
        {snap && card && knowledge && (
          <>
            <FlipCard key={card.id + (last?.result.event.id ?? '')} card={card} k={knowledge} flipped={flipped} onFlip={() => setFlipped(true)} />
            <div className="answer-bar">
              {!flipped ? (
                <button type="button" className="show-btn" onClick={() => setFlipped(true)}>Show answer</button>
              ) : (
                <div className="rating-row">
                  {RATINGS.map((r, i) => (
                    <button key={r.grade} type="button" className={cx('rate-btn', `rate-${r.tone}`)} onClick={() => void rate(r.grade)}>
                      <span className="rate-ivl">{intervals?.[i]?.label}</span>
                      <span className="rate-label">{r.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {snap && !card && (
          <Done
            reviewed={today?.totalDone ?? 0}
            unseen={snap.unseen}
            nextLearningAt={snap.nextLearningAt}
            onMore={() => {
              const extra = extraNew + 10;
              setExtraNew(extra);
              if (lib && today) refresh(lib, today, { extra });
            }}
          />
        )}
      </main>
    </div>
  );
}

function FlipCard({ card, k, flipped, onFlip }: { card: Card; k: Knowledge; flipped: boolean; onFlip: () => void }) {
  const cat = categoryOf(k);
  const { parts, answers } = splitFront(card);
  const head = (
    <div className="card-head">
      <span className="cat-chip">{cat.label}</span>
      {card.root && <span className="root-chip">{card.root}</span>}
    </div>
  );
  return (
    <div className={cx('flip-scene', `tone-${cat.tone}`)}>
      <div
        className={cx('flip-inner', flipped && 'is-flipped')}
        onClick={() => !flipped && onFlip()}
        role={flipped ? undefined : 'button'}
        aria-label={flipped ? undefined : 'Show answer'}
      >
        <section className="flash-card face-front" aria-hidden={flipped}>
          {head}
          <div className="card-body">
            <p className="phrase">
              {parts.map((p, i) => (
                <span key={i}>{p}{i < answers.length && <span className="gap-slot" aria-label="missing word" />}</span>
              ))}
            </p>
            {card.hint && <p className="cue">{card.hint}</p>}
          </div>
          <p className="tap-hint">Tap to flip</p>
        </section>
        <section className="flash-card face-back" aria-hidden={!flipped}>
          {head}
          <div className="card-body">
            <p className="phrase">
              {parts.map((p, i) => (
                <span key={i}>{p}{i < answers.length && <mark className="answer">{answers[i]}</mark>}</span>
              ))}
            </p>
            {card.hint && <p className="cue">{card.hint}</p>}
            {card.explanation && (
              <p className="example">
                {markedSegments(card.explanation).map((s, i) => (s.mark ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Done({ reviewed, unseen, nextLearningAt, onMore }: { reviewed: number; unseen: number; nextLearningAt?: number; onMore: () => void }) {
  const mins = nextLearningAt ? Math.max(1, Math.round((nextLearningAt - Date.now()) / 60_000)) : null;
  return (
    <div className="done-card">
      <div className="done-badge"><Check size={34} strokeWidth={2.6} /></div>
      <h2 className="font-display text-[28px] font-semibold text-ink">All caught up!</h2>
      <p className="mt-2 text-[15px] text-ink-2">
        {reviewed ? `You studied ${reviewed} card${reviewed === 1 ? '' : 's'} today.` : 'Nothing is due right now.'}
        {mins ? ` More cards will be ready in ${mins} min.` : ' Come back tomorrow for your next reviews.'}
      </p>
      {unseen > 0 && (
        <button type="button" className="show-btn mt-7" onClick={onMore}>
          <Plus size={18} strokeWidth={2.4} /> Learn 10 more
        </button>
      )}
    </div>
  );
}
