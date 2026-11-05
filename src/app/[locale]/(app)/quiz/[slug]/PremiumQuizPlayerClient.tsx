'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { PremiumCreditCost } from '@/features/quiz/components/PremiumCreditCost';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { QuizQuestionCard } from '@/features/quiz/components/player/QuizQuestionCard';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { ROUTES } from '@/shared/constants/routes';
import {
  fetchPremiumBatch,
  savePremiumAnswer,
  startPremiumSession,
  submitPremiumSession,
  unlockPremiumQuiz,
  type PremiumAnswerViewModel,
  type PremiumBatchViewModel,
} from '@/features/quiz/api/premium-quiz-api';

interface PremiumQuizPlayerClientProps {
  quizId: string;
  slug: string;
  title: string;
  questionCount: number;
  description?: string;
}

function isAuthRequired(error: unknown): boolean {
  return describeApiError(error).kind === 'auth_required';
}

export default function PremiumQuizPlayerClient({
  quizId,
  slug,
  title,
  questionCount,
  description,
}: PremiumQuizPlayerClientProps) {
  const t = useTranslations('quiz');
  const { push } = useRouter();
  const [batches, setBatches] = useState<Record<number, PremiumBatchViewModel>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<PremiumAnswerViewModel | null>>([]);
  const [sessionId, setSessionId] = useState('');
  const [watermark, setWatermark] = useState('');
  const [loading, setLoading] = useState(true);
  const [unlockRequired, setUnlockRequired] = useState(false);
  // A 401 at any step means the session is gone (RIN-747): ask to sign in again
  // instead of rendering the server's raw message.
  const [signInRequired, setSignInRequired] = useState(false);
  // Secondary actions (save, unlock, submit) show localized inline copy (RIN-753).
  const [error, setError] = useState('');
  // A failed start replaces the whole player with the page-level ErrorState.
  const [loadError, setLoadError] = useState<unknown>(null);
  const prefetching = useRef<Promise<void> | null>(null);
  const describeError = useApiErrorMessage();

  // 401 asks to sign in (RIN-747), unlock_required offers the unlock; the rest is a page error.
  function handleStartError(startError: unknown) {
    const { kind } = describeApiError(startError);
    if (kind === 'aborted') return;
    if (kind === 'auth_required') {
      setSignInRequired(true);
    } else if (kind === 'unlock_required') {
      setUnlockRequired(true);
    } else {
      setLoadError(startError);
    }
  }

  async function begin() {
    setLoading(true);
    setError('');
    setLoadError(null);
    try {
      const batch = await startPremiumSession(quizId);
      setBatches({ [batch.batchIndex]: batch });
      setCurrentIndex(batch.currentQuestionIndex);
      setAnswers(batch.answers);
      setSessionId(batch.sessionId);
      setWatermark(batch.watermark);
      setUnlockRequired(false);
    } catch (startError) {
      handleStartError(startError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void startPremiumSession(quizId)
      .then((batch) => {
        if (!active) return;
        setBatches({ [batch.batchIndex]: batch });
        setCurrentIndex(batch.currentQuestionIndex);
        setAnswers(batch.answers);
        setSessionId(batch.sessionId);
        setWatermark(batch.watermark);
        setUnlockRequired(false);
        setError('');
      })
      .catch((startError: unknown) => {
        if (active) handleStartError(startError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [quizId]);

  const batchIndex = Math.floor(currentIndex / 3);
  const currentBatch = batches[batchIndex];
  const question = currentBatch?.questions[currentIndex - (currentBatch?.startIndex ?? 0)];

  async function loadAdjacent(batch: PremiumBatchViewModel, cursor: string) {
    if (prefetching.current) return prefetching.current;
    prefetching.current = fetchPremiumBatch(batch.sessionId, cursor)
      .then((loaded) => {
        setBatches((current) => ({ ...current, [loaded.batchIndex]: loaded }));
        setWatermark(loaded.watermark);
      })
      .finally(() => {
        prefetching.current = null;
      });
    return prefetching.current;
  }

  const prefetchNextBatch = useEffectEvent((batch: PremiumBatchViewModel, cursor: string) => {
    void loadAdjacent(batch, cursor);
  });

  // Re-running is idempotent: a loaded next batch returns early, and `loadAdjacent`
  // shares one in-flight request.
  useEffect(() => {
    if (!currentBatch?.nextCursor || currentIndex - currentBatch.startIndex < 1) return;
    if (batches[currentBatch.batchIndex + 1]) return;
    prefetchNextBatch(currentBatch, currentBatch.nextCursor);
  }, [batches, currentBatch, currentIndex]);

  async function choose(answer: PremiumAnswerViewModel) {
    if (!sessionId) return;
    setAnswers((current) => {
      const next = [...current];
      next[currentIndex] = answer;
      return next;
    });
    try {
      await savePremiumAnswer(sessionId, currentIndex, answer);
    } catch (saveError) {
      if (isAuthRequired(saveError)) {
        setSignInRequired(true);
        return;
      }
      setError(describeError(saveError));
    }
  }

  async function move(delta: -1 | 1) {
    const target = currentIndex + delta;
    if (target < 0 || target >= questionCount || !currentBatch) return;
    const targetBatchIndex = Math.floor(target / 3);
    if (!batches[targetBatchIndex]) {
      const cursor = delta === 1 ? currentBatch.nextCursor : currentBatch.previousCursor;
      if (!cursor) return;
      await loadAdjacent(currentBatch, cursor);
    }
    setCurrentIndex(target);
  }

  async function unlock() {
    setLoading(true);
    setError('');
    try {
      await unlockPremiumQuiz(quizId);
      await begin();
    } catch (unlockError) {
      if (isAuthRequired(unlockError)) {
        setSignInRequired(true);
        return;
      }
      setError(describeError(unlockError));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const submitted = await submitPremiumSession(sessionId);
      push(`${ROUTES.QUIZ.RESULT(slug)}?attemptId=${encodeURIComponent(submitted.attemptId)}`);
    } catch (submitError) {
      if (isAuthRequired(submitError)) {
        setSignInRequired(true);
        return;
      }
      setError(describeError(submitError));
    } finally {
      setLoading(false);
    }
  }

  const watermarkCells = useMemo(
    () => Array.from({ length: 18 }, (_, index) => `${watermark}:${index}`),
    [watermark],
  );

  if (signInRequired) {
    return (
      <PremiumQuizSignInPrompt
        slug={slug}
        title={title}
        questionCount={questionCount}
        {...(description === undefined ? {} : { description })}
      />
    );
  }

  if (loading && !question && !unlockRequired) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-ink-muted">{t('loadingQuiz')}</div>
    );
  }

  if (unlockRequired) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <SurfaceCard className="p-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-5 rounded-xl bg-brand-trust/5 p-4 text-sm text-ink">
            {t('premiumUnlockDescription')}
          </p>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          ) : null}
          <Button
            className="mt-5"
            loading={loading}
            aria-label={t('premiumUnlockButton')}
            title={t('premiumUnlockButton')}
            onClick={() => void unlock()}
          >
            <PremiumCreditCost />
          </Button>
        </SurfaceCard>
      </main>
    );
  }

  if (!question || !currentBatch) {
    // The whole player failed to load: page variant, copy from the error layer (RIN-753).
    return (
      <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <h1 className="text-center text-2xl font-semibold text-ink">{title}</h1>
        <ErrorState error={loadError} variant="page" onRetry={begin} />
      </main>
    );
  }

  const selected = answers[currentIndex];
  return (
    <main className="premium-protected-content relative mx-auto min-h-screen max-w-4xl px-4 py-8">
      <div
        className="pointer-events-none fixed inset-0 z-40 grid grid-cols-3 content-around overflow-hidden opacity-10"
        aria-hidden="true"
      >
        {watermarkCells.map((cell) => (
          <span
            key={cell}
            className="-rotate-12 select-none text-center text-xs font-semibold text-ink"
          >
            {watermark}
          </span>
        ))}
      </div>
      <style jsx global>{`
        @media print {
          .premium-protected-content {
            break-inside: avoid;
          }
          .premium-protected-content::after {
            content: '${watermark.replaceAll("'", '')}';
            position: fixed;
            inset: 45% 10% auto;
            opacity: 0.18;
            transform: rotate(-18deg);
            font-size: 14pt;
          }
        }
      `}</style>
      <header className="relative z-50 mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-trust">
            Quiz Premium
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
        </div>
        <span className="text-sm text-ink-muted">
          {currentIndex + 1}/{questionCount}
        </span>
      </header>
      <div className="relative z-50">
        <QuizQuestionCard
          question={question}
          questionIndex={currentIndex}
          questionCount={questionCount}
          answer={selected}
          onSelectAnswer={(optionIndex) => {
            if (question.type === 'single') {
              void choose(optionIndex);
              return;
            }
            const values = Array.isArray(selected) ? selected : [];
            void choose(
              values.includes(optionIndex)
                ? values.filter((value) => value !== optionIndex)
                : [...values, optionIndex],
            );
          }}
          onPrevious={() => void move(-1)}
          onNext={() => void move(1)}
          onSubmit={() => void submit()}
          submitting={loading}
          error={error}
          t={t}
        />
      </div>
    </main>
  );
}
