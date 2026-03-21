'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ADAPTIVE_ROUTES } from './routes'
import type { BloomLevel } from './types'
import {
  ExerciseErrorState,
  ExerciseLoadingState,
  ExerciseQuestionView,
  ExerciseTheoryView,
} from './exercise-renderers'
import { useAdaptiveExerciseSession } from './hooks/use-adaptive-exercise-session'

interface ExerciseProps {
  sessionId: string
}

const BLOOM_LEVEL_COLORS: Record<string, string> = {
  Remember: 'bg-slate-100 text-slate-700',
  Understand: 'bg-teal-100 text-teal-700',
  Apply: 'bg-emerald-100 text-emerald-700',
  Analyze: 'bg-amber-100 text-amber-700',
  Evaluate: 'bg-orange-100 text-orange-700',
  Create: 'bg-rose-100 text-rose-700',
}

const BLOOM_TRANSLATION_KEYS: Record<BloomLevel, string> = {
  Remember: 'remember',
  Understand: 'understand',
  Apply: 'apply',
  Analyze: 'analyze',
  Evaluate: 'evaluate',
  Create: 'create',
}

export default function AdaptiveLearningExercise({ sessionId }: ExerciseProps) {
  const router = useRouter()
  const t = useTranslations('adaptiveLearning')

  const {
    concept,
    theory,
    exercise,
    selectedOption,
    loadingConcept,
    loadingTheory,
    loadingExercise,
    submitting,
    error,
    showTheory,
    setShowTheory,
    setSelectedOption,
    loadData,
    handleSubmit,
  } = useAdaptiveExerciseSession({
    sessionId,
    router,
    t,
  })

  const progressPercent = useMemo(() => {
    const itemInfo = concept || exercise
    if (!itemInfo || itemInfo.max_steps <= 0)
      return 0
    return (itemInfo.step / itemInfo.max_steps) * 100
  }, [exercise, concept])

  const bloomColor = useMemo(() => {
    const itemInfo = concept || exercise
    if (!itemInfo)
      return 'bg-slate-400 text-white'
    return BLOOM_LEVEL_COLORS[itemInfo.bloom_label] || 'bg-slate-400 text-white'
  }, [exercise, concept])

  const localizedBloomLabel = useMemo(() => {
    const itemInfo = concept || exercise
    if (!itemInfo)
      return ''
    return t(`bloom.${BLOOM_TRANSLATION_KEYS[itemInfo.bloom_label]}`)
  }, [exercise, concept, t])

  const optionEntries = useMemo(() => {
    if (!exercise)
      return []
    return Object.entries(exercise.options) as [string, string][]
  }, [exercise])

  if (loadingConcept)
    return <ExerciseLoadingState t={t as any} />

  if (error || !concept) {
    return (
      <ExerciseErrorState
        message={error || t('exercise.noExerciseAvailable')}
        onBack={() => router.push(ADAPTIVE_ROUTES.dashboard)}
        onRetry={() => void loadData()}
        t={t as any}
      />
    )
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
    )
  }

  return (
    <ExerciseQuestionView
      concept={concept}
      exercise={exercise}
      loadingExercise={loadingExercise}
      selectedOption={selectedOption}
      optionEntries={optionEntries}
      progressPercent={progressPercent}
      bloomColor={bloomColor}
      localizedBloomLabel={localizedBloomLabel}
      onQuit={() => router.push(ADAPTIVE_ROUTES.dashboard)}
      onSelectOption={setSelectedOption}
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
      t={t as any}
    />
  )
}
