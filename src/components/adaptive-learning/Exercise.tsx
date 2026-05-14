'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ADAPTIVE_ROUTES } from '@/features/adaptive-learning/lib/routes';
import type { BloomLevel } from '@/features/adaptive-learning/types';
import {
  ExerciseErrorState,
  ExerciseLoadingState,
  ExerciseQuestionView,
  ExerciseTheoryView,
} from './exercise-renderers';
import { useAdaptiveExerciseSession } from '@/features/adaptive-learning/hooks/use-adaptive-exercise-session';

interface ExerciseProps {
  sessionId: string;
}

const BLOOM_LEVEL_COLORS: Record<string, string> = {
  Remember: 'bg-neutral-500 text-white',
  Understand: 'bg-emerald-600 text-white',
  Apply: 'bg-teal-600 text-white',
  Analyze: 'bg-amber-500 text-white',
  Evaluate: 'bg-orange-600 text-white',
  Create: 'bg-rose-600 text-white',
};

const BLOOM_TRANSLATION_KEYS: Record<BloomLevel, string> = {
  Remember: 'remember',
  Understand: 'understand',
  Apply: 'apply',
  Analyze: 'analyze',
  Evaluate: 'evaluate',
  Create: 'create',
};

export default function AdaptiveLearningExercise({ sessionId }: ExerciseProps) {
  const { prefetch, push, replace } = useRouter();
  const t = useTranslations('adaptiveLearning');

  const {
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
    setOrderingAnswer,
    setTextAnswer,
    setMatchingOrder,
    loadData,
    handleSubmit,
  } = useAdaptiveExerciseSession({
    sessionId,
    router: { prefetch, push, replace },
    t,
  });

  const progressPercent = useMemo(() => {
    const itemInfo = concept || exercise;
    if (!itemInfo || itemInfo.max_steps <= 0) return 0;
    return (itemInfo.step / itemInfo.max_steps) * 100;
  }, [exercise, concept]);

  const bloomColor = useMemo(() => {
    const itemInfo = concept || exercise;
    if (!itemInfo) return 'bg-neutral-400 text-white';
    return BLOOM_LEVEL_COLORS[itemInfo.bloom_label] || 'bg-neutral-400 text-white';
  }, [exercise, concept]);

  const localizedBloomLabel = useMemo(() => {
    const itemInfo = concept || exercise;
    if (!itemInfo) return '';
    return t(`bloom.${BLOOM_TRANSLATION_KEYS[itemInfo.bloom_label]}`);
  }, [exercise, concept, t]);

  const optionEntries = useMemo(() => {
    if (!exercise) return [];
    return Object.entries(exercise.options) as [string, string][];
  }, [exercise]);

  const canSubmit = useMemo(() => {
    if (!exercise) return false;

    switch (exercise.exercise_type) {
      case 'mcq':
        return Boolean(answerDraft.choice);
      case 'true_false':
        return typeof answerDraft.boolean === 'boolean';
      case 'fill_blank':
        return Boolean(answerDraft.blanks?.some((value) => value.trim().length > 0));
      case 'multi_correct':
        return Boolean(answerDraft.choices?.length);
      case 'ordering':
        return Boolean(
          answerDraft.ordering && answerDraft.ordering.length === exercise.items.length,
        );
      case 'matching':
        return Object.keys(answerDraft.matching || {}).length === exercise.pairs.length;
      case 'short_answer':
        return Boolean(answerDraft.text?.trim());
      default:
        return false;
    }
  }, [answerDraft, exercise]);

  if (loadingConcept) return <ExerciseLoadingState t={t as any} />;

  if (error || !concept) {
    return (
      <ExerciseErrorState
        message={error || t('exercise.noExerciseAvailable')}
        onBack={() => push(ADAPTIVE_ROUTES.dashboard)}
        onRetry={() => void loadData()}
        t={t as any}
      />
    );
  }

  if (showTheory) {
    return (
      <ExerciseTheoryView
        concept={concept}
        theory={theory}
        loadingTheory={loadingTheory}
        loadingExercise={loadingExercise}
        onStartExercise={() => setShowTheory(false)}
        t={t as any}
      />
    );
  }

  return (
    <ExerciseQuestionView
      concept={concept}
      exercise={exercise}
      loadingExercise={loadingExercise}
      answerDraft={answerDraft}
      optionEntries={optionEntries}
      progressPercent={progressPercent}
      bloomColor={bloomColor}
      localizedBloomLabel={localizedBloomLabel}
      onQuit={() => push(ADAPTIVE_ROUTES.dashboard)}
      onSelectChoice={selectChoice}
      onToggleChoice={toggleChoice}
      onSetBooleanAnswer={setBooleanAnswer}
      onSetBlankAnswer={setBlankAnswer}
      onMoveOrderingItem={moveOrderingItem}
      onSetTextAnswer={setTextAnswer}
      onSetMatchingOrder={setMatchingOrder}
      onSetOrderingAnswer={setOrderingAnswer}
      onSubmit={() => void handleSubmit()}
      canSubmit={canSubmit}
      submitting={submitting}
      t={t as any}
    />
  );
}
