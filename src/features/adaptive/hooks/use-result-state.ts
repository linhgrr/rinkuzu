'use client';

import { useRouter } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { getSubjectHistoryDetailFresh } from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { getJobIdForSession, getSessionExerciseOutcome } from '../lib/session-storage';
import { buildExercisePromptText } from '@/features/adaptive/lib/exercise-prompt';
import { BLOOM_LABELS } from '@/features/adaptive/types/learning';
import type { SessionHistoryDetail } from '@/features/adaptive/types/history';
import type { Exercise, SubmitResult, TranslateFn } from '@/features/adaptive/types/learning';

interface ResultState {
  result: SubmitResult | null;
  exercise: Exercise | null;
  isChatOpen: boolean;
  hydrating: boolean;
}

type ResultStateAction =
  | { type: 'hydrateStart' }
  | { type: 'hydrateComplete'; result: SubmitResult | null; exercise: Exercise | null }
  | { type: 'setChatOpen'; value: boolean };

type DerivedResultOutcome = {
  exercise: Exercise;
  result: SubmitResult;
};

function resultStateReducer(state: ResultState, action: ResultStateAction): ResultState {
  switch (action.type) {
    case 'hydrateStart':
      return { ...state, hydrating: true };
    case 'hydrateComplete':
      return {
        ...state,
        result: action.result,
        exercise: action.exercise,
        hydrating: false,
      };
    case 'setChatOpen':
      return { ...state, isChatOpen: action.value };
    default:
      return state;
  }
}

function deriveOutcomeFromHistory(detail: SessionHistoryDetail): DerivedResultOutcome | null {
  const answered = detail.exercise_history.filter((item) => item.user_answer !== null);
  if (answered.length === 0) return null;

  const latest = answered.reduce((acc, item) => (item.timestamp > acc.timestamp ? item : acc));
  const bloomLabel = BLOOM_LABELS[latest.bloom_level - 1];
  if (!bloomLabel) {
    throw new TypeError(`Unsupported Bloom level in exercise history: ${latest.bloom_level}`);
  }
  const conceptMastery = detail.concept_mastery[latest.concept_idx];
  if (conceptMastery === undefined) {
    throw new TypeError(`Missing mastery for concept index ${latest.concept_idx}`);
  }
  if (latest.is_correct === null) {
    throw new TypeError(`Answered exercise ${latest.exercise_id} has no correctness result`);
  }

  return {
    exercise: {
      id: latest.exercise_id,
      exercise_id: latest.exercise_id,
      concept_name: latest.concept_name,
      concept_idx: latest.concept_idx,
      bloom_level: latest.bloom_level,
      bloom_label: bloomLabel,
      exercise_type: latest.exercise_type,
      question: latest.question,
      sentence: latest.sentence,
      options: latest.options,
      statement: latest.statement,
      hint: latest.hint,
      items: latest.items,
      pairs: latest.pairs,
      right_items: latest.right_items,
      rubric: latest.rubric,
      correct_answer: latest.correct_answer,
      step: answered.length,
      max_steps: detail.max_steps,
    },
    result: {
      is_correct: latest.is_correct,
      correct_option: latest.correct_option,
      explanation: latest.explanation,
      concept_name: latest.concept_name,
      bloom_level: latest.bloom_level,
      mastery_after: conceptMastery,
      avg_mastery: detail.avg_mastery,
      step: answered.length,
      session_completed: detail.status === 'completed' || answered.length >= detail.max_steps,
      stats: {
        total_correct: detail.total_correct,
        total_answered: detail.total_answered,
        accuracy: detail.accuracy,
      },
    },
  };
}

export const useResultState = (sessionId: string, t: TranslateFn) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(resultStateReducer, {
    result: null,
    exercise: null,
    isChatOpen: false,
    hydrating: true,
  });

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard);
    router.prefetch(ADAPTIVE_ROUTES.exercise(sessionId));
  }, [router, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      dispatch({ type: 'hydrateStart' });

      let nextResult: SubmitResult | null = null;
      let nextExercise: Exercise | null = null;

      try {
        const storedOutcome = getSessionExerciseOutcome(sessionId);
        if (storedOutcome) {
          nextResult = storedOutcome.result;
          nextExercise = storedOutcome.exercise;
        } else {
          const jobId = getJobIdForSession(sessionId);
          if (jobId) {
            const detail = await getSubjectHistoryDetailFresh(jobId);
            if (cancelled) return;

            const derivedOutcome = deriveOutcomeFromHistory(detail);
            nextResult = derivedOutcome?.result ?? null;
            nextExercise = derivedOutcome?.exercise ?? null;
          }
        }
      } catch {
        nextResult = null;
        nextExercise = null;
      }

      if (!cancelled) {
        dispatch({ type: 'hydrateComplete', result: nextResult, exercise: nextExercise });
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const { exercise, hydrating, isChatOpen, result } = state;
  const isCorrect = result?.is_correct ?? false;

  const masteryPercent = Math.round((result?.mastery_after ?? 0) * 100);

  const averageMasteryPercent = Math.round((result?.avg_mastery ?? 0) * 100);

  const questionOptions = (() => {
    if (!exercise) return [];

    return Object.entries(exercise.options)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  })();

  const chatContext = (() => {
    if (!exercise || !result) return '';

    return `${t('chatbot.contextConcept')}: ${result.concept_name}\n${t('chatbot.contextQuestion')}: ${buildExercisePromptText(exercise)}`;
  })();

  const handleGoDashboard = () => {
    router.push(ADAPTIVE_ROUTES.dashboard);
  };

  const handleNext = () => {
    if (!result) return;

    if (result.session_completed) {
      router.push(ADAPTIVE_ROUTES.dashboard);
      return;
    }

    router.push(ADAPTIVE_ROUTES.exercise(sessionId));
  };

  const openChat = () => {
    dispatch({ type: 'setChatOpen', value: true });
  };

  const closeChat = () => {
    dispatch({ type: 'setChatOpen', value: false });
  };

  return {
    averageMasteryPercent,
    chatContext,
    closeChat,
    exercise,
    handleGoDashboard,
    handleNext,
    hydrating,
    isChatOpen,
    isCorrect,
    masteryPercent,
    openChat,
    questionOptions,
    result,
  };
};
