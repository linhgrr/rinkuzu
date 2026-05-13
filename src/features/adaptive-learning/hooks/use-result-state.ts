'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSubjectHistoryDetailFresh } from '@/features/adaptive-learning/lib/api-client';
import { ADAPTIVE_ROUTES } from '@/features/adaptive-learning/lib/routes';
import { getJobIdForSession, getSessionExerciseOutcome } from '../lib/session-storage';
import { buildExercisePromptText } from '@/features/adaptive-learning/lib/exercise-prompt';
import { BLOOM_LABELS } from '@/features/adaptive-learning/types';
import type {
  Exercise,
  SessionHistoryDetail,
  SubmitResult,
} from '@/features/adaptive-learning/types';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

function deriveOutcomeFromHistory(
  detail: SessionHistoryDetail,
): { exercise: Exercise; result: SubmitResult } | null {
  const answered = detail.exercise_history.filter((item) => item.user_answer !== null);
  if (answered.length === 0) return null;

  const latest = answered.reduce((acc, item) => (item.timestamp > acc.timestamp ? item : acc));
  const bloomLabel =
    BLOOM_LABELS[Math.max(0, Math.min(BLOOM_LABELS.length - 1, latest.bloom_level - 1))] ||
    'Remember';
  const conceptMastery = detail.concept_mastery[latest.concept_idx];
  const masteryAfter = typeof conceptMastery === 'number' ? conceptMastery : detail.avg_mastery;

  return {
    exercise: {
      id: latest.exercise_id,
      exercise_id: latest.exercise_id,
      concept_name: latest.concept_name,
      concept_idx: latest.concept_idx,
      bloom_level: latest.bloom_level,
      bloom_label: bloomLabel,
      exercise_type: (latest.exercise_type as Exercise['exercise_type']) || 'mcq',
      question: latest.question,
      sentence: latest.sentence,
      options: latest.options,
      statement: latest.statement,
      hint: latest.hint,
      items: latest.items || [],
      pairs: latest.pairs || [],
      right_items: latest.right_items || [],
      rubric: latest.rubric || [],
      correct_answer: latest.correct_answer,
      step: answered.length,
      max_steps: detail.max_steps,
    },
    result: {
      is_correct: Boolean(latest.is_correct),
      correct_option: latest.correct_option,
      explanation: latest.explanation,
      concept_name: latest.concept_name,
      bloom_level: latest.bloom_level,
      mastery_after: masteryAfter,
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
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard);
    router.prefetch(ADAPTIVE_ROUTES.exercise(sessionId));
  }, [router, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setHydrating(true);

      try {
        const storedOutcome = getSessionExerciseOutcome(sessionId);
        if (storedOutcome) {
          if (!cancelled) {
            setResult(storedOutcome.result);
            setExercise(storedOutcome.exercise);
          }
          return;
        }

        const jobId = getJobIdForSession(sessionId);
        if (!jobId) return;

        const detail = await getSubjectHistoryDetailFresh(jobId);
        if (cancelled) return;

        const derivedOutcome = deriveOutcomeFromHistory(detail);
        setResult(derivedOutcome?.result ?? null);
        setExercise(derivedOutcome?.exercise ?? null);
      } catch {
        if (!cancelled) {
          setResult(null);
          setExercise(null);
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isCorrect = result?.is_correct ?? false;

  const masteryPercent = useMemo(() => Math.round((result?.mastery_after ?? 0) * 100), [result]);

  const averageMasteryPercent = useMemo(
    () => Math.round((result?.avg_mastery ?? 0) * 100),
    [result],
  );

  const questionOptions = useMemo(() => {
    if (!exercise) return [];

    return Object.entries(exercise.options)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [exercise]);

  const chatContext = useMemo(() => {
    if (!exercise || !result) return '';

    return `${t('chatbot.contextConcept')}: ${result.concept_name}\n${t('chatbot.contextQuestion')}: ${buildExercisePromptText(exercise)}`;
  }, [exercise, result, t]);

  const handleGoDashboard = useCallback(() => {
    router.push(ADAPTIVE_ROUTES.dashboard);
  }, [router]);

  const handleNext = useCallback(() => {
    if (!result) return;

    if (result.session_completed) {
      router.push(ADAPTIVE_ROUTES.dashboard);
      return;
    }

    router.push(ADAPTIVE_ROUTES.exercise(sessionId));
  }, [result, router, sessionId]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

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
