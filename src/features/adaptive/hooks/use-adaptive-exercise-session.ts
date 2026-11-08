import { useEffect, useEffectEvent, useRef, useState } from 'react';
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
import { captureAnalyticsEvent, captureAnalyticsEventOnce } from '@/lib/analytics/client';
import { withPending } from '@/lib/async/with-pending';

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
  const answerDraftRef = useRef<ExerciseAnswerDraft | null>(null);
  const [loadingConcept, setLoadingConcept] = useState(true);
  const [loadingTheory, setLoadingTheory] = useState(false);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const activeLoadRequestIdRef = useRef(0);
  const activeLoadSessionIdRef = useRef<string | null>(null);
  const submitIdempotencyRef = useRef<{ exerciseId: string; key: string } | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = async () => {
    if (!isMountedRef.current || activeLoadSessionIdRef.current === sessionId) return;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    activeLoadRequestIdRef.current = requestId;
    activeLoadSessionIdRef.current = sessionId;

    setLoadingTheory(false);
    setError(null);
    setSubmitError(null);
    answerDraftRef.current = null;
    setAnswerDraft(null);
    setConcept(null);
    setTheory(null);
    setExercise(null);
    setShowTheory(false);

    const isLatestActiveRequest = () =>
      isMountedRef.current && activeLoadRequestIdRef.current === requestId;
    const releaseLoadingLock = () => {
      if (activeLoadRequestIdRef.current === requestId) {
        activeLoadRequestIdRef.current = 0;
        activeLoadSessionIdRef.current = null;
      }
    };
    // Lowered in `withPending`'s finally, so a rejected or thrown load always clears it.
    // A superseded load leaves it alone: the newer request owns the flags then.
    const setStepLoading = (pending: boolean) => {
      if (!pending && !isLatestActiveRequest()) return;
      setLoadingConcept(pending);
      setLoadingExercise(pending);
    };

    let step: Awaited<ReturnType<typeof getLearningStep>>;
    try {
      step = await withPending(setStepLoading, () => getLearningStep(sessionId));
    } catch (err) {
      if (isLatestActiveRequest()) {
        setError(
          isSessionNotFoundError(err)
            ? t('exercise.failedToLoadExercise')
            : resolveExerciseFeedback(err, t, 'load'),
        );
      }
      releaseLoadingLock();
      return;
    }
    if (!isLatestActiveRequest()) {
      releaseLoadingLock();
      return;
    }

    setConcept(step.concept);
    setTheory(step.theory);
    setShowTheory(Boolean(step.theory));
    setExercise(step.exercise);
    captureAnalyticsEventOnce('adaptive_session_started', `adaptive-session-${sessionId}`, {
      journey_id: sessionId,
      exercise_type: step.exercise.exercise_type,
      bloom_level: step.exercise.bloom_level,
      has_theory: Boolean(step.theory),
    });
    const nextAnswerDraft =
      getSessionExerciseDraft(sessionId, step.exercise.exercise_id) ??
      createInitialExerciseAnswer(step.exercise);
    answerDraftRef.current = nextAnswerDraft;
    setAnswerDraft(nextAnswerDraft);
    releaseLoadingLock();
  };

  const setAndSaveAnswerDraft = (draft: ExerciseAnswerDraft) => {
    submitIdempotencyRef.current = null;
    setSubmitError(null);
    answerDraftRef.current = draft;
    setAnswerDraft(draft);
    if (exercise) {
      saveSessionExerciseDraft(sessionId, exercise.exercise_id, draft);
    }
  };

  const onLoadData = useEffectEvent(() => {
    void loadData();
  });

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) onLoadData();
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard);
    router.prefetch(ADAPTIVE_ROUTES.result(sessionId));
  }, [router, sessionId]);

  // The ref guards re-entry synchronously; the state drives the UI. They move together.
  const setSubmissionPending = (pending: boolean) => {
    submittingRef.current = pending;
    setSubmitting(pending);
  };

  const handleSubmit = async () => {
    if (
      submittingRef.current ||
      !exercise ||
      !answerDraft ||
      !hasCompleteExerciseAnswer(exercise, answerDraft)
    )
      return;

    setSubmitError(null);
    try {
      const result = await withPending(setSubmissionPending, () => {
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
        return submitAnswer(sessionId, {
          exercise_id: exercise.exercise_id,
          idempotency_key: submitIdempotencyRef.current.key,
          answer: toSubmitAnswerPayload(answerDraft),
        });
      });
      if (!isMountedRef.current) return;

      captureAnalyticsEvent('adaptive_answer_submitted', {
        journey_id: sessionId,
        exercise_type: exercise.exercise_type,
        bloom_level: exercise.bloom_level,
        is_correct: result.is_correct,
      });
      captureAnalyticsEventOnce('first_question_answered', 'first-question-answered', {
        learning_mode: 'adaptive',
        journey_id: sessionId,
      });
      saveSessionExerciseOutcome(sessionId, { result, exercise, answer: answerDraft });
      clearSessionExerciseDraft(sessionId, exercise.exercise_id);
      submitIdempotencyRef.current = null;
      router.push(ADAPTIVE_ROUTES.result(sessionId));
    } catch (err) {
      if (!isMountedRef.current) return;
      // Keep the question and the learner's answer on screen: the failure is inline (RIN-1011).
      setSubmitError(
        isSessionNotFoundError(err)
          ? t('exercise.failedToSubmitAnswer')
          : resolveExerciseFeedback(err, t, 'submit'),
      );
    }
  };

  const selectChoice = (choice: string) => {
    setAndSaveAnswerDraft({ type: 'mcq', selection: choice });
  };

  const toggleChoice = (choice: string) => {
    const current = answerDraftRef.current;
    if (current?.type !== 'multi_correct') {
      throw new TypeError('Cannot toggle a choice outside a multi-correct exercise');
    }
    const existing = new Set(current.selections);
    if (existing.has(choice)) existing.delete(choice);
    else existing.add(choice);

    setAndSaveAnswerDraft({
      type: current.type,
      selections: Array.from(existing).sort(),
    });
  };

  const setBooleanAnswer = (value: boolean) => {
    setAndSaveAnswerDraft({ type: 'true_false', value });
  };

  const setBlankAnswer = (value: string) => {
    setAndSaveAnswerDraft({ type: 'fill_blank', values: [value] });
  };

  const moveOrderingItem = (fromIndex: number, toIndex: number) => {
    const current = answerDraftRef.current;
    if (current?.type !== 'ordering') {
      throw new TypeError('Cannot move an item outside an ordering exercise');
    }
    const ordering = [...current.items];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= ordering.length || toIndex >= ordering.length)
      return;

    const [moved] = ordering.splice(fromIndex, 1);
    if (moved === undefined) {
      throw new TypeError(`No ordering item exists at index ${fromIndex}`);
    }
    ordering.splice(toIndex, 0, moved);
    setAndSaveAnswerDraft({ type: current.type, items: ordering });
  };

  const setTextAnswer = (value: string) => {
    setAndSaveAnswerDraft({ type: 'short_answer', text: value });
  };

  const setMatchingOrder = (leftItems: string[], rightItems: string[]) => {
    if (leftItems.length !== rightItems.length) {
      throw new TypeError(
        `Cannot pair ${leftItems.length} left item(s) with ${rightItems.length} right item(s)`,
      );
    }
    const matches: Record<string, string> = {};
    for (let index = 0; index < leftItems.length; index += 1) {
      const left = leftItems[index];
      const right = rightItems[index];
      if (left === undefined || right === undefined) {
        throw new TypeError(`Missing matching item at index ${index}`);
      }
      if (Object.hasOwn(matches, left)) {
        throw new TypeError(`Duplicate matching item: ${left}`);
      }
      matches[left] = right;
    }
    setAndSaveAnswerDraft({ type: 'matching', matches });
  };

  const setOrderingAnswer = (ordering: string[]) => {
    setAndSaveAnswerDraft({ type: 'ordering', items: ordering });
  };

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
    submitError,
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
