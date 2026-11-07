'use client';

import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { hasCompleteExerciseAnswer } from '@/features/adaptive/lib/exercise-answer';
import type { BloomLevel } from '@/features/adaptive/types/learning';
import {
  ExerciseErrorState,
  ExerciseLoadingState,
  ExerciseQuestionView,
  ExerciseTheoryView,
} from './exercise-renderers';
import { useAdaptiveExerciseSession } from '@/features/adaptive/hooks/use-adaptive-exercise-session';

interface ExerciseProps {
  sessionId: string;
}

const BLOOM_LEVEL_COLORS: Record<BloomLevel, string> = {
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
    submitError,
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

  const itemInfo = concept || exercise;
  const progressPercent =
    itemInfo && itemInfo.max_steps > 0 ? (itemInfo.step / itemInfo.max_steps) * 100 : 0;
  const bloomColor = itemInfo
    ? BLOOM_LEVEL_COLORS[itemInfo.bloom_label]
    : 'bg-neutral-400 text-white';
  const localizedBloomLabel = itemInfo
    ? t(`bloom.${BLOOM_TRANSLATION_KEYS[itemInfo.bloom_label]}`)
    : '';
  const optionEntries = exercise ? (Object.entries(exercise.options) as [string, string][]) : [];
  const canSubmit =
    exercise && answerDraft ? hasCompleteExerciseAnswer(exercise, answerDraft) : false;

  if (loadingConcept) return <ExerciseLoadingState t={t} />;

  if (error || !concept) {
    return (
      <ExerciseErrorState
        message={error || t('exercise.noExerciseAvailable')}
        onBack={() => push(ADAPTIVE_ROUTES.dashboard)}
        onRetry={() => void loadData()}
        t={t}
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
        t={t}
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
      submitError={submitError}
      t={t}
    />
  );
}
