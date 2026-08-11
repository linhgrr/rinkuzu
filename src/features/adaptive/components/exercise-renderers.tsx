'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { HiArrowRight, HiBookOpen, HiLightBulb, HiOutlineX } from 'react-icons/hi';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { getExercisePromptSections } from '@/features/adaptive/lib/exercise-prompt';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type {
  Exercise,
  NextConcept,
  RichTranslateFn,
  TheoryData,
} from '@/features/adaptive/types/learning';

const ExerciseInteraction = dynamic(
  () => import('./exercise-question-interaction').then((module) => module.ExerciseInteraction),
  {
    loading: () => (
      <div className="grid gap-3 sm:gap-4">
        <div className="h-16 w-full animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-neutral-100" />
      </div>
    ),
  },
);

type ExerciseLoadingStateProps = {
  t: RichTranslateFn;
};

export const ExerciseLoadingState = ({ t }: ExerciseLoadingStateProps) => (
  <div
    className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center"
    aria-busy="true"
    aria-label={t('exercise.loadingTitle')}
  >
    <div className="mb-8 space-y-2 text-center">
      <Skeleton className="mx-auto h-8 w-72 max-w-full rounded-md" />
      <Skeleton className="mx-auto h-5 w-96 max-w-full rounded-md" />
    </div>
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <Skeleton className="h-6 w-44 rounded-md" />
      <Skeleton className="mt-4 h-5 w-full rounded-md" />
      <Skeleton className="mt-2 h-5 w-4/5 rounded-md" />
      <div className="mt-8 grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={`exercise-option-skeleton-${index}`} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

type ErrorStateProps = {
  message: string;
  onBack: () => void;
  onRetry: () => void;
  t: RichTranslateFn;
};

export const ExerciseErrorState = ({ message, onBack, onRetry, t }: ErrorStateProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
    <div className="space-y-4 text-center">
      <p className="text-lg text-red-500">{message}</p>
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          className="border-control-border hover:bg-neutral-50 text-neutral-700"
          onClick={onBack}
        >
          {t('exercise.backToDashboard')}
        </Button>
        <Button
          className="bg-brand-trust hover:bg-brand-trust-hover shadow-none text-white transition-colors"
          onClick={onRetry}
        >
          {t('exercise.tryAgain')}
        </Button>
      </div>
    </div>
  </div>
);

type TheoryViewProps = {
  concept: NextConcept;
  theory: TheoryData | null;
  loadingTheory: boolean;
  loadingExercise: boolean;
  onStartExercise: () => void;
  t: RichTranslateFn;
};

function getExerciseHeaderContent(exercise: Exercise): string | null {
  const promptSections = getExercisePromptSections(exercise);
  if (exercise.exercise_type === 'true_false' || exercise.exercise_type === 'fill_blank') {
    return promptSections.lead;
  }

  return promptSections.primary;
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
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
        {t('exercise.theory.reviewKnowledge')}
      </h1>
      <p className="text-sm md:text-base text-neutral-500">
        {t.rich('exercise.theory.theoryReview', {
          concept: concept.concept_name,
          highlight: (chunks: React.ReactNode) => (
            <span className="font-medium text-neutral-900">{chunks}</span>
          ),
        })}
      </p>
    </div>

    <div className="grid gap-6 md:gap-8 pb-12 md:grid-cols-1">
      <Card className="overflow-hidden rounded-xl border-line shadow-sm bg-white p-5 sm:p-8 md:p-10 relative">
        {loadingTheory ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center min-h-[300px]">
            <HiLightBulb className="size-8 text-neutral-400 mb-4 animate-pulse" />
            <TextShimmer className="text-lg font-medium text-neutral-400" duration={1.5}>
              {t('exercise.theory.generatingExplanationFor', { concept: concept.concept_name })}
            </TextShimmer>
          </div>
        ) : theory ? (
          <>
            <div className="mb-8">
              <h3 className="mb-4 flex items-center gap-2 text-lg md:text-xl font-medium text-neutral-900 border-b border-line/50 pb-4">
                <HiBookOpen className="size-5 text-neutral-900" />{' '}
                {t('exercise.theory.basicTheory')}
              </h3>
              <div className="text-base md:text-lg leading-relaxed text-neutral-700">
                <MarkdownRenderer content={theory.content} />
              </div>
            </div>

            {theory.examples && theory.examples.length > 0 && (
              <div>
                <h3 className="mb-5 md:mb-6 flex items-center gap-2 text-base md:text-lg font-medium text-neutral-900">
                  <HiLightBulb className="size-5 text-neutral-900" />{' '}
                  {t('exercise.theory.illustration')}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {theory.examples.map((ex: string, idx: number) => (
                    <div
                      key={ex}
                      className="rounded-xl bg-neutral-50 border border-line p-5 md:p-6 transition-colors hover:border-line-blue shadow-sm"
                    >
                      <div className="mb-2.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-brand-trust">
                        {t('exercise.theory.example', { index: idx + 1 })}
                      </div>
                      <div className="text-sm md:text-base text-neutral-700 leading-relaxed">
                        <MarkdownRenderer content={ex} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-neutral-500">
            {t('exercise.theory.failedToLoad')}
          </div>
        )}
      </Card>

      <div className="flex justify-center pt-2 md:pt-4 px-4 flex-col items-center gap-3">
        {loadingExercise && !loadingTheory && (
          <TextShimmer className="text-sm font-medium text-neutral-400" duration={1.2}>
            {t('exercise.preparingExercise')}
          </TextShimmer>
        )}
        <Button
          onClick={onStartExercise}
          disabled={loadingExercise}
          className="h-12 min-h-[48px] w-full rounded-full bg-brand-action px-8 text-sm font-medium text-white shadow-md transition-[background-color,transform] active:scale-[0.98] hover:bg-brand-action-hover disabled:bg-neutral-200 disabled:text-neutral-400 md:h-11 md:min-w-[200px] md:w-auto md:text-base"
        >
          {loadingExercise ? t('exercise.loadingTitle') : t('exercise.theory.startExercise')}
          {!loadingExercise && <HiArrowRight className="ml-2 size-4" />}
        </Button>
      </div>
    </div>
  </div>
);

type ExerciseQuestionViewProps = {
  concept: NextConcept;
  exercise: Exercise | null;
  loadingExercise: boolean;
  answerDraft: ExerciseAnswerDraft | null;
  optionEntries: [string, string][];
  progressPercent: number;
  bloomColor: string;
  localizedBloomLabel: string;
  onQuit: () => void;
  onSelectChoice: (value: string) => void;
  onToggleChoice: (value: string) => void;
  onSetBooleanAnswer: (value: boolean) => void;
  onSetBlankAnswer: (value: string) => void;
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void;
  onSetTextAnswer: (value: string) => void;
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void;
  onSetOrderingAnswer: (value: string[]) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
  t: RichTranslateFn;
};

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
  <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col font-home text-ink">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          onClick={onQuit}
          className="font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md px-4 min-h-[44px] border border-transparent hover:border-control-border"
        >
          <HiOutlineX className="mr-2 size-4" />
          {t('quit')}
        </Button>
        <div className="hidden h-6 w-px bg-neutral-200 sm:block" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
            {t('exercise.progress')}
          </span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-100 border border-line">
              <div
                className="h-full rounded-full bg-brand-trust transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-mono text-neutral-600">{concept.step}</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <span className="line-clamp-2 rounded-md border border-line bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {concept.concept_name}
        </span>
      </div>
    </div>

    <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col lg:col-span-8">
        <Card className="flex-1 rounded-xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line/50 px-5 sm:px-6 py-4 bg-neutral-50/50 rounded-t-[20px]">
            <div
              className={`flex items-center gap-2 rounded-md ${bloomColor} px-3 py-1.5 box-border shadow-sm`}
            >
              <div className="size-2 rounded-full bg-white/90" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('exercise.bloomBadge', {
                  level: concept.bloom_level,
                  label: localizedBloomLabel,
                })}
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              {t('exercise.stepCounter', { current: concept.step + 1 })}
            </span>
          </div>

          {loadingExercise ? (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center">
              <TextShimmer className="text-lg font-medium text-neutral-500 mb-6" duration={1.2}>
                {t('exercise.constructingChallenge')}
              </TextShimmer>
              <div className="grid gap-4 w-full max-w-[400px]">
                <div className="h-14 w-full bg-neutral-100 animate-pulse rounded-xl" />
                <div className="h-14 w-full bg-neutral-100 animate-pulse rounded-xl delay-75" />
                <div className="h-14 w-full bg-neutral-100 animate-pulse rounded-xl delay-150" />
              </div>
            </div>
          ) : exercise && answerDraft ? (
            <CardContent className="p-5 sm:p-6 md:p-10">
              {(() => {
                const headerContent = getExerciseHeaderContent(exercise);
                return headerContent ? (
                  <h2 className="mb-8 text-xl font-medium leading-relaxed text-neutral-900 tracking-tight">
                    <MarkdownRenderer content={headerContent} />
                  </h2>
                ) : null;
              })()}
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
            <div className="py-12 text-center text-neutral-500">
              {t('exercise.failedToLoadContent')}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-4">
        <div className="relative overflow-hidden rounded-xl bg-neutral-50 border border-line p-5 sm:p-6 text-neutral-900 shadow-sm">
          <div className="relative z-10">
            <h3 className="mb-3 text-base font-semibold tracking-tight flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-trust animate-pulse" />
              {t('focusModeTitle')}
            </h3>
            <p className="mb-6 text-sm text-neutral-600 leading-relaxed">
              {t('exercise.focusModeContext', {
                concept: concept.concept_name,
                level: localizedBloomLabel,
              })}
            </p>
            <Button
              className="h-12 min-h-[48px] w-full justify-center rounded-full bg-brand-action py-2 text-sm font-medium text-white shadow-sm transition-[background-color,transform] active:scale-[0.98] hover:bg-brand-action-hover sm:h-11 sm:min-h-[44px] sm:hover:scale-[1.02] md:text-base"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? t('exercise.checking') : t('checkAnswer')}
              {!submitting ? <HiArrowRight className="ml-2 size-4" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
