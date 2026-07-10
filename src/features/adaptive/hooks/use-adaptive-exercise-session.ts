import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdaptiveApiError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
  isSessionNotFoundError,
} from '@/features/adaptive/lib/adaptive-api-error';
import { getLearningStep, submitAnswer } from '@/features/adaptive/lib/adaptive-api-methods';
import {
  createInitialExerciseAnswer,
  hasCompleteExerciseAnswer,
} from '@/features/adaptive/lib/exercise-answer';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import {
  clearSessionExerciseDraft,
  getSessionExerciseDraft,
  saveSessionExerciseDraft,
  saveSessionExerciseOutcome,
} from '../lib/session-storage';
import { toSubmitAnswerPayload } from '@/features/adaptive/mappers/exercise-answer.mapper';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type {
  Exercise,
  NextConcept,
  TheoryData,
  TranslateFn,
} from '@/features/adaptive/types/learning';

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => void;
};

type UseAdaptiveExerciseSessionParams = {
  sessionId: string;
  router: RouterLike;
  t: TranslateFn;
};

function resolveExerciseFeedback(
  error: unknown,
  t: TranslateFn,
  intent: 'load' | 'submit',
): string {
  const defaultMessage =
    intent === 'load' ? t('exercise.failedToLoadExercise') : t('exercise.failedToSubmitAnswer');

  if (error instanceof AdaptiveApiError) {
    if (isAdaptiveRequestAbortedError(error) || isAdaptiveServiceUnavailableError(error)) {
      return intent === 'load' ? t('exercise.serviceUnavailable') : t('exercise.submitUnavailable');
    }
  }

  return defaultMessage;
}

export const useAdaptiveExerciseSession = ({
  sessionId,
  router,
  t,
}: UseAdaptiveExerciseSessionParams) => {
  const [concept, setConcept] = useState<NextConcept | null>(null);
  const [theory, setTheory] = useState<TheoryData | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answerDraft, setAnswerDraft] = useState<ExerciseAnswerDraft | null>(null);
  const [loadingConcept, setLoadingConcept] = useState(true);
  const [loadingTheory, setLoadingTheory] = useState(false);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const submitIdempotencyRef = useRef<{ exerciseId: string; key: string } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!isMountedRef.current || loadingRef.current) return;

    loadingRef.current = true;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    setLoadingConcept(true);
    setLoadingTheory(false);
    setLoadingExercise(true);
    setError(null);
    setAnswerDraft(null);
    setConcept(null);
    setTheory(null);
    setExercise(null);
    setShowTheory(false);

    const isLatestActiveRequest = () =>
      isMountedRef.current && activeRequestIdRef.current === requestId;

    try {
      const step = await getLearningStep(sessionId);
      if (!isLatestActiveRequest()) return;

      setConcept(step.concept);
      setLoadingConcept(false);
      setTheory(step.theory);
      setShowTheory(Boolean(step.theory));
      setExercise(step.exercise);
      setAnswerDraft(
        getSessionExerciseDraft(sessionId, step.exercise.exercise_id) ??
          createInitialExerciseAnswer(step.exercise),
      );
      setLoadingTheory(false);
      setLoadingExercise(false);
    } catch (err) {
      if (!isLatestActiveRequest()) return;

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToLoadExercise'));
        setLoadingConcept(false);
        setLoadingTheory(false);
        setLoadingExercise(false);
        return;
      }

      setError(resolveExerciseFeedback(err, t, 'load'));
      setLoadingConcept(false);
      setLoadingTheory(false);
      setLoadingExercise(false);
    } finally {
      loadingRef.current = false;
    }
  }, [sessionId, t]);

  const setAndSaveAnswerDraft = useCallback(
    (draft: ExerciseAnswerDraft) => {
      setAnswerDraft(draft);
      if (exercise) {
        saveSessionExerciseDraft(sessionId, exercise.exercise_id, draft);
      }
    },
    [exercise, sessionId],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard);
    router.prefetch(ADAPTIVE_ROUTES.result(sessionId));
  }, [router, sessionId]);

  const handleSubmit = useCallback(async () => {
    if (!exercise || !answerDraft || !hasCompleteExerciseAnswer(exercise, answerDraft)) return;

    setSubmitting(true);
    try {
      router.prefetch(ADAPTIVE_ROUTES.result(sessionId));
      if (submitIdempotencyRef.current?.exerciseId !== exercise.exercise_id) {
        submitIdempotencyRef.current = {
          exerciseId: exercise.exercise_id,
          key:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${exercise.exercise_id}-${Date.now()}`,
        };
      }
      const result = await submitAnswer(sessionId, {
        exercise_id: exercise.exercise_id,
        idempotency_key: submitIdempotencyRef.current.key,
        answer: toSubmitAnswerPayload(answerDraft),
      });
      if (!isMountedRef.current) return;

      saveSessionExerciseOutcome(sessionId, { result, exercise });
      clearSessionExerciseDraft(sessionId, exercise.exercise_id);
      submitIdempotencyRef.current = null;
      router.push(ADAPTIVE_ROUTES.result(sessionId));
    } catch (err) {
      if (!isMountedRef.current) return;

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToSubmitAnswer'));
        return;
      }

      setError(resolveExerciseFeedback(err, t, 'submit'));
    } finally {
      if (!isMountedRef.current) return;
      setSubmitting(false);
    }
  }, [answerDraft, exercise, router, sessionId, t]);

  const selectChoice = useCallback(
    (choice: string) => {
      setAndSaveAnswerDraft({ type: 'mcq', selection: choice });
    },
    [setAndSaveAnswerDraft],
  );

  const toggleChoice = useCallback(
    (choice: string) => {
      setAnswerDraft((current) => {
        if (current?.type !== 'multi_correct') {
          throw new TypeError('Cannot toggle a choice outside a multi-correct exercise');
        }
        const existing = new Set(current.selections);
        if (existing.has(choice)) existing.delete(choice);
        else existing.add(choice);

        const nextDraft = { type: current.type, selections: Array.from(existing).sort() };
        if (exercise) {
          saveSessionExerciseDraft(sessionId, exercise.exercise_id, nextDraft);
        }
        return nextDraft;
      });
    },
    [exercise, sessionId],
  );

  const setBooleanAnswer = useCallback(
    (value: boolean) => {
      setAndSaveAnswerDraft({ type: 'true_false', value });
    },
    [setAndSaveAnswerDraft],
  );

  const setBlankAnswer = useCallback(
    (value: string) => {
      setAndSaveAnswerDraft({ type: 'fill_blank', values: [value] });
    },
    [setAndSaveAnswerDraft],
  );

  const moveOrderingItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      setAnswerDraft((current) => {
        if (current?.type !== 'ordering') {
          throw new TypeError('Cannot move an item outside an ordering exercise');
        }
        const ordering = [...current.items];
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= ordering.length ||
          toIndex >= ordering.length
        )
          return current;

        const [moved] = ordering.splice(fromIndex, 1);
        if (moved === undefined) {
          throw new TypeError(`No ordering item exists at index ${fromIndex}`);
        }
        ordering.splice(toIndex, 0, moved);
        const nextDraft = { type: current.type, items: ordering };
        if (exercise) {
          saveSessionExerciseDraft(sessionId, exercise.exercise_id, nextDraft);
        }
        return nextDraft;
      });
    },
    [exercise, sessionId],
  );

  const setTextAnswer = useCallback(
    (value: string) => {
      setAndSaveAnswerDraft({ type: 'short_answer', text: value });
    },
    [setAndSaveAnswerDraft],
  );

  const setMatchingOrder = useCallback(
    (leftItems: string[], rightItems: string[]) => {
      if (leftItems.length !== rightItems.length) {
        throw new TypeError(
          `Cannot pair ${leftItems.length} left item(s) with ${rightItems.length} right item(s)`,
        );
      }
      setAndSaveAnswerDraft({
        type: 'matching',
        matches: Object.fromEntries(leftItems.map((left, index) => [left, rightItems[index]])),
      });
    },
    [setAndSaveAnswerDraft],
  );

  const setOrderingAnswer = useCallback(
    (ordering: string[]) => {
      setAndSaveAnswerDraft({ type: 'ordering', items: ordering });
    },
    [setAndSaveAnswerDraft],
  );

  return {
    concept,
    theory,
    exercise,
    answerDraft,
    loadingConcept,
    loadingTheory,
    loadingExercise,
    submitting,
    error,
    showTheory,
    setShowTheory,
    selectChoice,
    toggleChoice,
    setBooleanAnswer,
    setBlankAnswer,
    moveOrderingItem,
    setTextAnswer,
    setMatchingOrder,
    setOrderingAnswer,
    loadData,
    handleSubmit,
  };
};
