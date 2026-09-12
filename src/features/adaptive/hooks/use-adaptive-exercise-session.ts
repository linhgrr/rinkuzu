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

    setLoadingConcept(true);
    setLoadingTheory(false);
    setLoadingExercise(true);
    setError(null);
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

    try {
      const step = await getLearningStep(sessionId);
      if (!isLatestActiveRequest()) {
        releaseLoadingLock();
        return;
      }

      setConcept(step.concept);
      setLoadingConcept(false);
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
      setLoadingTheory(false);
      setLoadingExercise(false);
      releaseLoadingLock();
    } catch (err) {
      if (!isLatestActiveRequest()) {
        releaseLoadingLock();
        return;
      }

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToLoadExercise'));
        setLoadingConcept(false);
        setLoadingTheory(false);
        setLoadingExercise(false);
        releaseLoadingLock();
        return;
      }

      setError(resolveExerciseFeedback(err, t, 'load'));
      setLoadingConcept(false);
      setLoadingTheory(false);
      setLoadingExercise(false);
      releaseLoadingLock();
    }
  };

  const setAndSaveAnswerDraft = (draft: ExerciseAnswerDraft) => {
    submitIdempotencyRef.current = null;
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

  const handleSubmit = async () => {
    if (
      submittingRef.current ||
      !exercise ||
      !answerDraft ||
      !hasCompleteExerciseAnswer(exercise, answerDraft)
    )
      return;

    submittingRef.current = true;
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
      saveSessionExerciseOutcome(sessionId, { result, exercise });
      clearSessionExerciseDraft(sessionId, exercise.exercise_id);
      submitIdempotencyRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
      router.push(ADAPTIVE_ROUTES.result(sessionId));
    } catch (err) {
      if (!isMountedRef.current) {
        submittingRef.current = false;
        return;
      }

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToSubmitAnswer'));
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      setError(resolveExerciseFeedback(err, t, 'submit'));
      submittingRef.current = false;
      setSubmitting(false);
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
