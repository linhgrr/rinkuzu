'use client';

import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { PremiumUnlockCard } from '@/features/quiz/components/PremiumUnlockCard';
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
import { initialPremiumPlayerState, premiumPlayerReducer } from './premium-player-state';

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
  const [state, dispatch] = useReducer(premiumPlayerReducer, initialPremiumPlayerState);
  const {
    batches,
    currentIndex,
    answers,
    sessionId,
    watermark,
    loading,
    unlockRequired,
    signInRequired,
    error,
    loadError,
  } = state;
  const prefetching = useRef<Promise<void> | null>(null);
  const describeError = useApiErrorMessage();

  function handleStartError(startError: unknown) {
    dispatch({ type: 'startFailed', kind: describeApiError(startError).kind, error: startError });
  }

  async function begin() {
    dispatch({ type: 'startRequested' });
    try {
      const batch = await startPremiumSession(quizId);
      dispatch({ type: 'sessionStarted', batch });
    } catch (startError) {
      handleStartError(startError);
    } finally {
      dispatch({ type: 'settled' });
    }
  }

  useEffect(() => {
    let active = true;
    void startPremiumSession(quizId)
      .then((batch) => {
        if (!active) return;
        dispatch({ type: 'sessionStarted', batch });
      })
      .catch((startError: unknown) => {
        if (active) handleStartError(startError);
      })
      .finally(() => {
        if (active) dispatch({ type: 'settled' });
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
        dispatch({ type: 'batchLoaded', batch: loaded });
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
    dispatch({ type: 'answerChosen', index: currentIndex, answer });
    try {
      await savePremiumAnswer(sessionId, currentIndex, answer);
    } catch (saveError) {
      if (isAuthRequired(saveError)) {
        dispatch({ type: 'signInRequired' });
        return;
      }
      dispatch({ type: 'actionFailed', message: describeError(saveError) });
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
    dispatch({ type: 'moved', index: target });
  }

  async function unlock() {
    dispatch({ type: 'actionRequested', clearError: true });
    try {
      await unlockPremiumQuiz(quizId);
      await begin();
    } catch (unlockError) {
      if (isAuthRequired(unlockError)) {
        dispatch({ type: 'signInRequired' });
        return;
      }
      dispatch({ type: 'actionFailed', message: describeError(unlockError) });
    } finally {
      dispatch({ type: 'settled' });
    }
  }

  async function submit() {
    if (!sessionId) return;
    dispatch({ type: 'actionRequested', clearError: false });
    try {
      const submitted = await submitPremiumSession(sessionId);
      push(`${ROUTES.QUIZ.RESULT(slug)}?attemptId=${encodeURIComponent(submitted.attemptId)}`);
    } catch (submitError) {
      if (isAuthRequired(submitError)) {
        dispatch({ type: 'signInRequired' });
        return;
      }
      dispatch({ type: 'actionFailed', message: describeError(submitError) });
    } finally {
      dispatch({ type: 'settled' });
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
      <PremiumUnlockCard
        title={title}
        description={t('premiumUnlockDescription')}
        loading={loading}
        error={error}
        onUnlock={unlock}
      />
    );
  }

  if (!question || !currentBatch) {
    // The whole player failed to load: page variant, copy from the error layer (RIN-753).
    return (
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <h1 className="text-center text-2xl font-semibold text-ink">{title}</h1>
        <ErrorState error={loadError} variant="page" onRetry={begin} />
      </div>
    );
  }

  const selected = answers[currentIndex];
  return (
    <div className="premium-protected-content relative mx-auto min-h-screen max-w-4xl px-4 py-8">
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
    </div>
  );
}
