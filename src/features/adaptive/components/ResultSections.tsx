'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { HiArrowRight, HiCheck, HiOutlineHome, HiOutlineX } from 'react-icons/hi';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type { SubmitResult, Exercise, TranslateFn } from '@/features/adaptive/types/learning';
import styles from './LearningViewport.module.css';
import { AdaptiveReviewPrompt } from './AdaptiveReviewPrompt';
import { ResultCorrectAnswer, ResultLearnerAnswer } from './ResultAnswers';

type ResultEmptyStateProps = {
  onChooseSubject: () => void;
  onBackToSubject: () => void;
  t: TranslateFn;
};

export const ResultLoadingState = ({ t }: { t: TranslateFn }) => (
  <div
    className={`${styles['learningViewport']} mx-auto flex max-w-4xl flex-col justify-center`}
    aria-busy="true"
    aria-label={t('exercise.loadingTitle')}
  >
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <Skeleton className="h-8 w-56 rounded-md" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full rounded-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={`result-stat-skeleton-${index}`} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-36 rounded-xl" />
    </div>
  </div>
);

export const ResultEmptyState = ({
  onChooseSubject,
  onBackToSubject,
  t,
}: ResultEmptyStateProps) => (
  <div
    className={`${styles['learningViewport']} mx-auto flex max-w-4xl items-center justify-center`}
  >
    <div className="max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-neutral-900">{t('result.noResultDataFound')}</h1>
      <p className="text-sm text-neutral-500">{t('result.noResultDataDescription')}</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <Button
          variant="outline"
          className="min-h-11 border-control-border text-neutral-700 transition-colors hover:bg-neutral-50"
          onClick={onBackToSubject}
        >
          {t('result.backToSubject')}
        </Button>
        <Button
          className="min-h-11 bg-brand-action font-semibold text-brand-action-text hover:bg-brand-action-hover"
          onClick={onChooseSubject}
        >
          {t('result.chooseAnotherSubject')}
          <HiArrowRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  </div>
);

type ResultContentProps = {
  answer: ExerciseAnswerDraft | null;
  averageMasteryPercent: number;
  exercise: Exercise;
  isCorrect: boolean;
  masteryPercent: number;
  onGoDashboard: () => void;
  onHandleNext: () => void;
  onOpenChat: () => void;
  result: SubmitResult;
  t: TranslateFn;
};

export const ResultContent = ({
  answer,
  averageMasteryPercent,
  exercise,
  isCorrect,
  masteryPercent,
  onGoDashboard,
  onHandleNext,
  onOpenChat,
  result,
  t,
}: ResultContentProps) => (
  <div
    className={`${styles['learningViewport']} mx-auto flex max-w-4xl flex-col items-center justify-center pb-[4.5rem] pt-8 font-home lg:pb-8 text-ink`}
  >
    <div className="mb-6 flex w-full flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
      <div
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          isCorrect
            ? 'bg-green-500 text-white shadow-md'
            : 'border border-line bg-neutral-100 text-neutral-600'
        }`}
      >
        {isCorrect ? <HiCheck className="size-6" /> : <HiOutlineX className="size-6" />}
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          {isCorrect ? t('result.correctTitle') : t('result.incorrectTitle')}
        </h1>
        <p className="text-sm text-neutral-500">
          {isCorrect ? t('result.correctDescription') : t('result.incorrectDescription')}
        </p>
      </div>
      <Button
        variant="outline"
        className="hidden min-h-11 rounded-full border-control-border px-5 font-semibold text-neutral-700 hover:bg-neutral-50 sm:ml-auto xl:inline-flex"
        onClick={onHandleNext}
        data-testid="result-next-secondary"
      >
        {result.session_completed ? t('result.sessionCompleteCta') : t('result.nextExercise')}
        <HiArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>

    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className={`h-1.5 w-full ${isCorrect ? 'bg-brand-trust' : 'bg-red-300'}`} />
          <CardHeader className="border-b border-line/50 bg-neutral-50/50 px-6 py-3">
            <h3 className="font-medium tracking-tight text-neutral-900">
              {t('result.explanationTitle')}
            </h3>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4 text-sm leading-relaxed text-neutral-700">
              <MarkdownRenderer content={result.explanation} />
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-green-100 bg-green-50/50 p-5 shadow-sm">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  <HiCheck className="size-4" />
                </div>
                <div className="flex-1">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-green-600">
                    {t('result.correctAnswerLabel')}
                  </span>
                  <div className="text-sm font-medium text-neutral-900">
                    <ResultCorrectAnswer exercise={exercise} result={result} t={t} />
                  </div>
                </div>
              </div>
              <ResultLearnerAnswer
                answer={answer}
                exercise={exercise}
                isCorrect={isCorrect}
                t={t}
              />
            </div>

            <div className="mt-6 border-t border-line/50 pt-6">
              <Button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-control-border bg-white text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 hover:shadow-sm"
                onClick={onOpenChat}
              >
                <span className="relative flex size-7 items-center justify-center rounded-full border border-line bg-neutral-100">
                  <Image
                    src="/images/chatbot_icon.png"
                    alt={t('chatbot.iconAlt')}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                  />
                </span>
                <span>{t('result.chatWithTutor')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-4 font-medium tracking-tight text-neutral-900">
              {t('result.masteryUpdate')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                  {result.concept_name} <span className="text-neutral-400">/</span>{' '}
                  {t('bloomLevel', { level: result.bloom_level })}
                </span>
                <span className="font-mono text-sm font-medium text-neutral-900">
                  {masteryPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-line bg-neutral-100">
                <div
                  className="h-full rounded-full bg-brand-trust transition-[width] duration-500"
                  style={{ width: `${masteryPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{t('result.averageMastery', { value: averageMasteryPercent })}</span>
                <span className="font-mono">{t('result.stepLabel', { step: result.step })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 pb-6 sm:flex-row sm:gap-4">
          <Button
            variant="ghost"
            className="h-12 rounded-xl border border-control-border font-semibold text-neutral-600 sm:flex-1 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            onClick={onGoDashboard}
          >
            <HiOutlineHome className="mr-2 size-5" />
            {t('result.dashboard')}
          </Button>
          <Button
            className="h-12 rounded-xl bg-brand-action sm:flex-[2] font-semibold text-brand-action-text shadow-md transition-[background-color,transform] hover:bg-brand-action-hover focus:ring-brand-trust active:scale-[0.98]"
            onClick={onHandleNext}
          >
            {result.session_completed ? t('result.sessionCompleteCta') : t('result.nextExercise')}
            <HiArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            {t('result.sessionStats')}
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line/50 pb-3">
              <span className="text-xs font-medium text-neutral-700">
                {t('result.statsCorrect')}
              </span>
              <span className="font-mono text-sm text-neutral-900">
                {result.stats.total_correct}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line/50 pb-3">
              <span className="text-xs font-medium text-neutral-700">{t('result.statsTotal')}</span>
              <span className="font-mono text-sm text-neutral-900">
                {result.stats.total_answered}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700">
                {t('result.statsAccuracy')}
              </span>
              <span className="font-mono text-sm text-neutral-900">
                {Math.round(result.stats.accuracy * 100)}%
              </span>
            </div>
          </div>
        </div>

        {result.session_completed ? (
          <div className="rounded-xl border border-line bg-neutral-50 p-6 text-center text-neutral-900 shadow-sm">
            <div className="mb-3 flex justify-center">
              <div className="rounded-full border border-line-blue bg-neutral-200 p-2 text-neutral-900">
                <HiCheck className="size-5" />
              </div>
            </div>
            <h3 className="mb-1 text-base font-medium">{t('result.sessionCompleteTitle')}</h3>
            <p className="mt-1 text-xs text-neutral-500">
              {t('result.sessionCompleteDescription', { count: result.step })}
            </p>
            <div className="mt-4 empty:hidden">
              <AdaptiveReviewPrompt />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  </div>
);
