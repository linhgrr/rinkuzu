'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { HiArrowRight, HiBookOpen, HiLightBulb, HiOutlineX } from '@/components/icons'
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { ExerciseInteraction } from './exercise-question-interaction'
import type { Exercise, NextConcept, SubmitAnswerPayload, TheoryData } from './types'

type TranslateFn = ((key: string, values?: Record<string, any>) => string) & {
  rich: (key: string, values: Record<string, any>) => React.ReactNode
}

type LoadingStateProps = {
  t: TranslateFn
}

export const ExerciseLoadingState = ({ t }: LoadingStateProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
    <div className="text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      <p className="text-base font-medium text-slate-900">{t('exercise.loadingTitle')}</p>
      <p className="mt-1 text-sm text-slate-500">{t('exercise.loadingSubtitle')}</p>
    </div>
  </div>
)

type ErrorStateProps = {
  message: string
  onBack: () => void
  onRetry: () => void
  t: TranslateFn
}

export const ExerciseErrorState = ({ message, onBack, onRetry, t }: ErrorStateProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
    <div className="space-y-4 text-center">
      <p className="text-lg text-red-500">{message}</p>
      <div className="flex justify-center gap-3">
        <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700" onClick={onBack}>
          {t('exercise.backToDashboard')}
        </Button>
        <Button className="bg-teal-600 hover:bg-teal-700 shadow-none text-white transition-colors" onClick={onRetry}>
          {t('exercise.tryAgain')}
        </Button>
      </div>
    </div>
  </div>
)

type TheoryViewProps = {
  concept: NextConcept
  theory: TheoryData | null
  loadingTheory: boolean
  loadingExercise: boolean
  onStartExercise: () => void
  t: TranslateFn
}

export const ExerciseTheoryView = ({
  concept,
  theory,
  loadingTheory,
  loadingExercise,
  onStartExercise,
  t,
}: TheoryViewProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col">
    <div className="mb-8 md:mb-10 text-center px-4">
      <div className="mx-auto mb-5 md:mb-6 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-[18px] bg-slate-50 border border-slate-200 text-slate-900 shadow-sm">
        <HiBookOpen className="h-6 w-6 md:h-8 md:w-8" />
      </div>
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t('exercise.theory.reviewKnowledge')}</h1>
      <p className="text-sm md:text-base text-slate-500">
        {t.rich('exercise.theory.theoryReview', {
          concept: concept.concept_name,
          highlight: (chunks: React.ReactNode) => <span className="font-medium text-slate-900">{chunks}</span>,
        })}
      </p>
    </div>

    <div className="grid gap-6 md:gap-8 pb-12 md:grid-cols-1">
      <Card className="overflow-hidden rounded-[20px] border-slate-200 shadow-sm bg-white p-5 sm:p-8 md:p-10 relative">
        {loadingTheory ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center min-h-[300px]">
            <HiLightBulb className="h-8 w-8 text-slate-400 mb-4 animate-pulse" />
            <TextShimmer className="text-lg font-medium text-slate-400" duration={1.5}>
              {t('exercise.theory.generatingExplanationFor', { concept: concept.concept_name })}
            </TextShimmer>
          </div>
        ) : theory ? (
          <>
            <div className="mb-8">
              <h3 className="mb-4 flex items-center gap-2 text-lg md:text-xl font-medium text-slate-900 border-b border-slate-100 pb-4">
                <HiBookOpen className="h-5 w-5 text-slate-900" /> {t('exercise.theory.basicTheory')}
              </h3>
              <div className="text-base md:text-lg leading-relaxed text-slate-700">
                <DynamicMarkdownRenderer content={theory.content} />
              </div>
            </div>

            {theory.examples && theory.examples.length > 0 && (
              <div>
                <h3 className="mb-5 md:mb-6 flex items-center gap-2 text-base md:text-lg font-medium text-slate-900">
                  <HiLightBulb className="h-5 w-5 text-slate-900" /> {t('exercise.theory.illustration')}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {theory.examples.map((ex: string, idx: number) => (
                    <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-5 md:p-6 transition-colors hover:border-slate-300 shadow-sm">
                      <div className="mb-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-slate-900">
                        {t('exercise.theory.example', { index: idx + 1 })}
                      </div>
                      <div className="text-sm md:text-base text-slate-700 leading-relaxed">
                        <DynamicMarkdownRenderer content={ex} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-slate-500">{t('exercise.theory.failedToLoad')}</div>
        )}
      </Card>

      <div className="flex justify-center pt-2 md:pt-4 px-4 flex-col items-center gap-3">
        {loadingExercise && !loadingTheory && (
          <TextShimmer className="text-sm font-medium text-slate-400" duration={1.2}>
            {t('exercise.preparingExercise')}
          </TextShimmer>
        )}
        <Button
          onClick={onStartExercise}
          disabled={loadingExercise}
          className="w-full md:w-auto h-12 md:h-11 min-h-[48px] md:min-w-[200px] rounded-full bg-teal-600 px-8 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] hover:bg-teal-700 shadow-md disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loadingExercise ? t('exercise.loadingTitle') : t('exercise.theory.startExercise')}
          {!loadingExercise && <HiArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  </div>
)

export type ExerciseQuestionViewProps = {
  concept: NextConcept
  exercise: Exercise | null
  loadingExercise: boolean
  answerDraft: SubmitAnswerPayload
  optionEntries: [string, string][]
  progressPercent: number
  bloomColor: string
  localizedBloomLabel: string
  onQuit: () => void
  onSelectChoice: (value: string) => void
  onToggleChoice: (value: string) => void
  onSetBooleanAnswer: (value: boolean) => void
  onSetBlankAnswer: (value: string) => void
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void
  onSetTextAnswer: (value: string) => void
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void
  onSetOrderingAnswer: (value: string[]) => void
  onSubmit: () => void
  canSubmit: boolean
  submitting: boolean
  t: TranslateFn
}
export const ExerciseQuestionView = ({
  concept,
  exercise,
  loadingExercise,
  answerDraft,
  optionEntries,
  progressPercent,
  bloomColor,
  localizedBloomLabel,
  onQuit,
  onSelectChoice,
  onToggleChoice,
  onSetBooleanAnswer,
  onSetBlankAnswer,
  onMoveOrderingItem,
  onSetTextAnswer,
  onSetMatchingOrder,
  onSetOrderingAnswer,
  onSubmit,
  canSubmit,
  submitting,
  t,
}: ExerciseQuestionViewProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col">
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={onQuit}
          className="font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md px-4 min-h-[44px] border border-transparent hover:border-slate-200"
        >
          <HiOutlineX className="mr-2 h-4 w-4" />
          {t('quit')}
        </Button>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{t('exercise.progress')}</span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
              <div className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-xs font-mono text-slate-600">{concept.step}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">{concept.concept_name}</span>
      </div>
    </div>

    <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col lg:col-span-8">
        <Card className="flex-1 rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-slate-50/50 rounded-t-[20px]">
            <div className={`flex items-center gap-2 rounded-md ${bloomColor} px-2.5 py-1 box-border`}>
              <div className="h-2 w-2 rounded-full bg-white opacity-80" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                {t('exercise.bloomBadge', { level: concept.bloom_level, label: localizedBloomLabel })}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {t('exercise.stepCounter', { current: concept.step + 1 })}
            </span>
          </div>

          {loadingExercise ? (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center">
              <TextShimmer className="text-lg font-medium text-slate-500 mb-6" duration={1.2}>
                {t('exercise.constructingChallenge')}
              </TextShimmer>
              <div className="grid gap-4 w-full max-w-[400px]">
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl" />
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-75" />
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-150" />
              </div>
            </div>
          ) : exercise ? (
            <CardContent className="p-5 sm:p-6 md:p-10">
              {!(exercise.exercise_type === 'fill_blank' && exercise.sentence) ? (
                <h2 className="mb-8 text-xl font-medium leading-relaxed text-slate-900 tracking-tight">
                  <DynamicMarkdownRenderer content={exercise.question} />
                </h2>
              ) : null}
              <ExerciseInteraction
                answerDraft={answerDraft}
                exercise={exercise}
                onMoveOrderingItem={onMoveOrderingItem}
                onSelectChoice={onSelectChoice}
                onSetBlankAnswer={onSetBlankAnswer}
                onSetBooleanAnswer={onSetBooleanAnswer}
                onSetTextAnswer={onSetTextAnswer}
                onSetMatchingOrder={onSetMatchingOrder}
                onSetOrderingAnswer={onSetOrderingAnswer}
                onToggleChoice={onToggleChoice}
                optionEntries={optionEntries}
              />
            </CardContent>
          ) : (
            <div className="py-12 text-center text-slate-500">{t('exercise.failedToLoadContent')}</div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-4">
        <div className="relative overflow-hidden rounded-[20px] bg-slate-50 border border-slate-200 p-5 sm:p-6 text-slate-900 shadow-sm">
          <div className="relative z-10">
            <h3 className="mb-3 text-base font-semibold tracking-tight flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
              {t('focusModeTitle')}
            </h3>
            <p className="mb-6 text-sm text-slate-600 leading-relaxed">
              {t('exercise.focusModeContext', {
                concept: concept.concept_name,
                level: localizedBloomLabel,
              })}
            </p>
            <Button
              className="w-full min-h-[48px] h-12 sm:h-11 sm:min-h-[44px] rounded-full bg-teal-600 py-2 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] sm:hover:scale-[1.02] hover:bg-teal-700 justify-center shadow-sm"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? t('exercise.checking') : t('checkAnswer')}
              {!submitting ? <HiArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
)
