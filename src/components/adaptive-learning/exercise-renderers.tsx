'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { HiArrowRight, HiBookOpen, HiLightBulb, HiOutlineX } from '@/components/icons'
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { ADAPTIVE_ROUTES } from './routes'
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
          <div className="py-12 text-center text-slate-500">Failed to load theory</div>
        )}
      </Card>

      <div className="flex justify-center pt-2 md:pt-4 px-4 flex-col items-center gap-3">
        {loadingExercise && !loadingTheory && (
          <TextShimmer className="text-sm font-medium text-slate-400" duration={1.2}>
            Preparing your exercise...
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

type QuestionViewProps = {
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
  onSetMatchingAnswer: (left: string, right: string) => void
  onSubmit: () => void
  canSubmit: boolean
  submitting: boolean
  t: TranslateFn
}

function OptionCard({
  active,
  badge,
  onClick,
  value,
}: {
  active: boolean
  badge: string
  onClick: () => void
  value: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full cursor-pointer items-start gap-4 rounded-[12px] border p-4 text-left transition-all duration-200 sm:p-5 ${active
        ? 'border-teal-600 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-400 active:scale-[0.99]'
      }`}
    >
      {active && <div className="absolute inset-0 rounded-xl bg-teal-500/10" />}
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm ${active
          ? 'border-teal-600 bg-teal-600 text-white'
          : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
        }`}
      >
        {badge}
      </div>
      <span className={`text-base leading-relaxed transition-colors duration-200 ${active ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
        <DynamicMarkdownRenderer content={value} />
      </span>
    </button>
  )
}

function ExerciseInteraction({
  answerDraft,
  exercise,
  onMoveOrderingItem,
  onSelectChoice,
  onSetBlankAnswer,
  onSetBooleanAnswer,
  onSetTextAnswer,
  onSetMatchingAnswer,
  onToggleChoice,
  optionEntries,
}: {
  answerDraft: SubmitAnswerPayload
  exercise: Exercise
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void
  onSelectChoice: (value: string) => void
  onSetBlankAnswer: (value: string) => void
  onSetBooleanAnswer: (value: boolean) => void
  onSetTextAnswer: (value: string) => void
  onSetMatchingAnswer: (left: string, right: string) => void
  onToggleChoice: (value: string) => void
  optionEntries: [string, string][]
}) {
  if (exercise.exercise_type === 'true_false') {
    return (
      <div className="grid gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-relaxed text-slate-800">
          <DynamicMarkdownRenderer content={exercise.statement || exercise.question} />
        </div>
        {[
          { label: 'T', value: 'True', bool: true },
          { label: 'F', value: 'False', bool: false },
        ].map(item => (
          <OptionCard
            key={item.value}
            active={answerDraft.boolean === item.bool}
            badge={item.label}
            onClick={() => onSetBooleanAnswer(item.bool)}
            value={item.value}
          />
        ))}
      </div>
    )
  }

  if (exercise.exercise_type === 'fill_blank') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-relaxed text-slate-800">
          <DynamicMarkdownRenderer content={exercise.question} />
        </div>
        <textarea
          value={answerDraft.blanks?.[0] || ''}
          onChange={event => onSetBlankAnswer(event.target.value)}
          rows={3}
          placeholder="Nhập đáp án vào chỗ trống"
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-teal-600"
        />
        {exercise.hint ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Gợi ý: {exercise.hint}
          </div>
        ) : null}
      </div>
    )
  }

  if (exercise.exercise_type === 'multi_correct') {
    const selectedChoices = new Set(answerDraft.choices || [])
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chọn tất cả đáp án đúng.
        </div>
        <div className="grid gap-3 sm:gap-4">
          {optionEntries.map(([key, value]) => (
            <OptionCard
              key={key}
              active={selectedChoices.has(key)}
              badge={key}
              onClick={() => onToggleChoice(key)}
              value={value}
            />
          ))}
        </div>
      </div>
    )
  }

  if (exercise.exercise_type === 'ordering') {
    const ordering = answerDraft.ordering || exercise.items
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sắp xếp các mục theo thứ tự đúng.
        </div>
        <div className="space-y-3">
          {ordering.map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="flex-1 text-sm leading-relaxed text-slate-800">
                <DynamicMarkdownRenderer content={item} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700"
                  onClick={() => onMoveOrderingItem(index, index - 1)}
                  disabled={index === 0}
                >
                  Up
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700"
                  onClick={() => onMoveOrderingItem(index, index + 1)}
                  disabled={index === ordering.length - 1}
                >
                  Down
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (exercise.exercise_type === 'short_answer') {
    return (
      <div className="space-y-4">
        {exercise.rubric.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 text-sm font-semibold text-slate-900">Tiêu chí chấm</div>
            <ul className="space-y-2 text-sm text-slate-700">
              {exercise.rubric.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <textarea
          value={answerDraft.text || ''}
          onChange={event => onSetTextAnswer(event.target.value)}
          rows={8}
          placeholder="Viết câu trả lời ngắn của bạn"
          className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-teal-600"
        />
      </div>
    )
  }

  if (exercise.exercise_type === 'matching') {
    const matching = answerDraft.matching || {}
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Ghép mỗi mục ở cột trái với đáp án phù hợp ở cột phải.
        </div>
        <div className="space-y-3">
          {exercise.pairs.map((pair) => (
            <div key={pair.left} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div className="text-sm leading-relaxed text-slate-800">
                <DynamicMarkdownRenderer content={pair.left} />
              </div>
              <select
                value={matching[pair.left] || ''}
                onChange={(event) => onSetMatchingAnswer(pair.left, event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-teal-600"
              >
                <option value="">Chọn đáp án</option>
                {exercise.right_items.map((item) => (
                  <option key={`${pair.left}-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:gap-4">
      {optionEntries.map(([key, value], idx) => (
        <OptionCard
          key={key}
          active={answerDraft.choice === key}
          badge={String.fromCharCode(65 + idx)}
          onClick={() => onSelectChoice(key)}
          value={value}
        />
      ))}
    </div>
  )
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
  onSetMatchingAnswer,
  onSubmit,
  canSubmit,
  submitting,
  t,
}: QuestionViewProps) => (
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
        <Card className="flex-1 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-slate-50/50">
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
                Constructing your challenge...
              </TextShimmer>
              <div className="grid gap-4 w-full max-w-[400px]">
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl" />
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-75" />
                <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-150" />
              </div>
            </div>
          ) : exercise ? (
            <CardContent className="p-5 sm:p-6 md:p-10">
              <h2 className="mb-8 text-xl font-medium leading-relaxed text-slate-900 tracking-tight">
                <DynamicMarkdownRenderer content={exercise.question} />
              </h2>
              <ExerciseInteraction
                answerDraft={answerDraft}
                exercise={exercise}
                onMoveOrderingItem={onMoveOrderingItem}
                onSelectChoice={onSelectChoice}
                onSetBlankAnswer={onSetBlankAnswer}
                onSetBooleanAnswer={onSetBooleanAnswer}
                onSetTextAnswer={onSetTextAnswer}
                onSetMatchingAnswer={onSetMatchingAnswer}
                onToggleChoice={onToggleChoice}
                optionEntries={optionEntries}
              />
            </CardContent>
          ) : (
            <div className="py-12 text-center text-slate-500">Exercise failed to load</div>
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
