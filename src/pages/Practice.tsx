import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import { loadLibrary, type Library } from '../lib/queue';
import {
  availableModes, checkGap, gradeOf, modeOf, pickCard, pickMode, splitGaps,
  type GapResult, type PracticeHistory, type PracticeMode,
} from '../lib/practice';
import { recordReview } from '../lib/repo';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';
import type { Card } from '../lib/types';

interface Current {
  card: Card;
  mode: PracticeMode;
  parts: string[];
  answers: string[][];
  shownAt: number;
}

function prepare(card: Card): Current | null {
  const gaps = splitGaps(card);
  const mode = modeOf(card);
  if (!gaps || !mode) return null;
  return { card, mode, ...gaps, shownAt: Date.now() };
}

export default function Practice() {
  const lib = useRef<Library | null>(null);
  const history = useRef<PracticeHistory>({ cards: [], knowledge: [], modes: [] });
  const [current, setCurrent] = useState<Current | null>(null);
  const [empty, setEmpty] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const [results, setResults] = useState<GapResult[] | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const cardRef = useRef<HTMLElement>(null);

  const advance = useCallback(() => {
    const l = lib.current;
    if (!l) return;
    const h = history.current;
    const available = availableModes(l);
    let mode = pickMode(h.modes, available);
    let card = pickCard(l, mode, h);
    if (!card) {
      mode = mode === 'phrase' ? 'wf' : 'phrase';
      card = pickCard(l, mode, h);
    }
    const next = card && prepare(card);
    if (!next) {
      setEmpty(true);
      return;
    }
    h.cards.push(next.card.id);
    h.knowledge.push(next.card.knowledgeId);
    h.modes.push(next.mode);
    setCurrent(next);
    setValues(next.answers.map(() => ''));
    setResults(null);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadLibrary().then((l) => {
      if (!alive) return;
      lib.current = l;
      advance();
    });
    // Al volver a la app se recarga: puede haber repasos nuevos sincronizados desde el otro dispositivo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadLibrary().then((l) => { lib.current = l; });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [advance]);

  // Animación de entrada de cada tarjeta, sin desmontar los campos (así el teclado del iPhone no se cierra).
  useLayoutEffect(() => {
    if (!current) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) cardRef.current?.animate(
      [{ opacity: 0, transform: 'translateY(10px) scale(0.99)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
    inputs.current[0]?.focus({ preventScroll: true });
  }, [current]);

  const check = useCallback(() => {
    if (!current || results) return;
    const res = current.answers.map((accepted, i) => checkGap(values[i] ?? '', accepted));
    setResults(res);
    const rating = gradeOf(res);
    void recordReview({ card: current.card, rating, durationMs: Date.now() - current.shownAt }).then((r) => {
      lib.current?.states.set(current.card.id, r.after);
    });
  }, [current, results, values]);

  const primary = useCallback(() => (results ? advance() : check()), [results, advance, check]);

  // Enter fuera de un campo (p. ej. en la notebook después de corregir) también avanza.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      primary();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary]);

  const onGapKey = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextEmpty = !results && current && i < current.answers.length - 1 && !values[i + 1]?.trim();
    if (nextEmpty) inputs.current[i + 1]?.focus();
    else primary();
  };

  const typed = values.some((v) => v.trim());
  const label = results ? 'Next' : typed ? 'Check' : 'Show answer';
  const grade = results && gradeOf(results);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="ambient" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)] sm:px-8 sm:pt-8">
        <Logo />
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
        >
          <SettingsIcon size={20} strokeWidth={1.8} />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[7vh] sm:px-8 sm:pt-[14vh]">
        {empty && <p className="text-center text-muted">Nothing to practise yet.</p>}
        {current && (
          <>
            <article
              ref={cardRef}
              className={cx('practice-card', current.mode === 'wf' ? 'is-wf' : 'is-phrase', grade === 3 && 'is-right', grade === 1 && 'is-wrong')}
            >
              {current.mode === 'wf' && (
                <div className="mb-5 flex justify-end">
                  <span className="root-word">{current.card.root}</span>
                </div>
              )}
              {current.card.type === 'kwt' && (
                <div className="mb-6">
                  <p className="text-[15px] leading-relaxed text-ink-2 sm:text-base">{current.card.original}</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="keyword">{current.card.keyword}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </div>
              )}
              <p className="sentence">
                {current.parts.map((text, i) => (
                  <span key={`seg-${i}`}>
                    {text}
                    {i < current.answers.length && (
                      <Gap
                        value={results ? current.answers[i][0] : values[i] ?? ''}
                        attempt={results && results[i] !== 'right' ? values[i]?.trim() : undefined}
                        result={results?.[i]}
                        inputRef={(el) => { inputs.current[i] = el; }}
                        onChange={(v) => !results && setValues((prev) => prev.map((x, j) => (j === i ? v : x)))}
                        onKeyDown={onGapKey(i)}
                        last={i === current.answers.length - 1}
                      />
                    )}
                  </span>
                ))}
              </p>
            </article>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={primary}
              className={cx('primary-action', results ? 'is-next' : typed ? 'is-check' : 'is-show')}
            >
              {label}
              {results && <ArrowRight size={18} strokeWidth={2.2} />}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function Gap({ value, attempt, result, inputRef, onChange, onKeyDown, last }: {
  value: string;
  attempt?: string;
  result?: GapResult;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  last: boolean;
}) {
  // Revelada, la respuesta se muestra como texto (puede partirse en varias líneas); el campo queda oculto
  // pero con foco, para que Enter avance y el teclado del iPhone no se cierre.
  return (
    <span className={cx('gap-wrap', result && 'is-revealed')}>
      {attempt ? <s className="attempt">{attempt}</s> : null}
      {result ? <mark className={cx('answer', `answer-${result}`)}>{value}</mark> : null}
      <span className="gap">
        <span className="gap-mirror" aria-hidden>{value || ' '}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Answer"
          size={1}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint={result || last ? 'go' : 'next'}
        />
      </span>
    </span>
  );
}
