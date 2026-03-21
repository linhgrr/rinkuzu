'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer'
import {
  HiArrowRight,
  HiCheck,
  HiOutlineHome,
  HiOutlineX,
} from '@/components/icons'
import type { SubmitResult } from './types'

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ResultEmptyStateProps = {
  onGoDashboard: () => void
  t: TranslateFn
}

export const ResultLoadingState = ({ t }: { t: TranslateFn }) => (
  <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
    <div className="space-y-3 text-center">
      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      <p className="text-sm font-medium text-slate-500">{t('exercise.loadingTitle')}</p>
    </div>
  </div>
)

export const ResultEmptyState = ({ onGoDashboard, t }: ResultEmptyStateProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
    <div className="space-y-4 text-center">
      <p className="text-sm font-medium text-slate-500">{t('result.noResultDataFound')}</p>
      <Button
        variant="outline"
        className="border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
        onClick={onGoDashboard}
      >
        {t('exercise.backToDashboard')}
      </Button>
    </div>
  </div>
)

type ResultContentProps = {
  averageMasteryPercent: number
  isCorrect: boolean
  masteryPercent: number
  onGoDashboard: () => void
  onHandleNext: () => void
  onOpenChat: () => void
  result: SubmitResult
  t: TranslateFn
}

export const ResultContent = ({
  averageMasteryPercent,
  isCorrect,
  masteryPercent,
  onGoDashboard,
  onHandleNext,
  onOpenChat,
  result,
  t,
}: ResultContentProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center py-8">
    <div className="mb-6 flex w-full flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
      <div
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          isCorrect
            ? 'bg-emerald-500 text-white shadow-md'
            : 'border border-slate-200 bg-slate-100 text-slate-600'
        }`}
      >
        {isCorrect ? <HiCheck className="h-6 w-6" /> : <HiOutlineX className="h-6 w-6" />}
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {isCorrect ? t('result.correctTitle') : t('result.incorrectTitle')}
        </h1>
        <p className="text-sm text-slate-500">
          {isCorrect ? t('result.correctDescription') : t('result.incorrectDescription')}
        </p>
      </div>
    </div>

    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className={`h-1.5 w-full ${isCorrect ? 'bg-slate-900' : 'bg-slate-300'}`} />
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-3">
            <h3 className="font-medium tracking-tight text-slate-900">{t('result.explanationTitle')}</h3>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4 text-sm leading-relaxed text-slate-700">
              <DynamicMarkdownRenderer content={result.explanation} />
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <HiCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-900" />
              <div>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {t('result.correctAnswerLabel')}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  <DynamicMarkdownRenderer content={result.correct_option} />
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <Button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 hover:shadow-sm"
                onClick={onOpenChat}
              >
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                  <Image
                    src="/images/chatbot_icon.png"
                    alt="Rin-chan avatar"
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

        <Card className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-4 font-medium tracking-tight text-slate-900">{t('result.masteryUpdate')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {result.concept_name} <span className="text-slate-400">/</span> {t('bloomLevel', { level: result.bloom_level })}
                </span>
                <span className="font-mono text-sm font-medium text-slate-900">{masteryPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${masteryPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{t('result.averageMastery', { value: averageMasteryPercent })}</span>
                <span className="font-mono">{t('result.stepLabel', { step: result.step })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 pb-6">
          <Button
            variant="ghost"
            className="h-12 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            onClick={onGoDashboard}
          >
            <HiOutlineHome className="mr-2 h-5 w-5" />
            {t('result.dashboard')}
          </Button>
          <Button
            className="h-12 flex-[2] rounded-xl bg-teal-600 font-semibold text-white shadow-md transition-all hover:bg-teal-700 focus:ring-teal-500 active:scale-[0.98]"
            onClick={onHandleNext}
          >
            {result.session_completed ? t('result.sessionCompleteCta') : t('result.nextExercise')}
            <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('result.sessionStats')}</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-medium text-slate-700">{t('result.statsCorrect')}</span>
              <span className="font-mono text-sm text-slate-900">{result.stats.total_correct}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-medium text-slate-700">{t('result.statsTotal')}</span>
              <span className="font-mono text-sm text-slate-900">{result.stats.total_answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">{t('result.statsAccuracy')}</span>
              <span className="font-mono text-sm text-slate-900">{Math.round(result.stats.accuracy * 100)}%</span>
            </div>
          </div>
        </div>

        {result.session_completed ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-900 shadow-sm">
            <div className="mb-3 flex justify-center">
              <div className="rounded-full border border-slate-300 bg-slate-200 p-2 text-slate-900">
                <HiCheck className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mb-1 text-base font-medium">{t('result.sessionCompleteTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('result.sessionCompleteDescription', { count: result.step })}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  </div>
)
