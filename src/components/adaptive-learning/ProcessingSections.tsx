'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  HiCheck,
  HiOutlineArrowLeft,
  HiOutlineExclamationCircle,
  HiOutlineSparkles,
} from '@/components/icons'
import type { PipelineJobStatus } from './types'
import type { ProcessingStep } from './hooks/use-processing-state'

const ProcessingGraphPanel = dynamic(() => import('./ProcessingGraphPanel'), {
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
      </div>
    </div>
  ),
  ssr: false,
})

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ProcessingStats = {
  concepts_extracted: number
  concepts_after_merge: number
  relations_verified: number
}

type ProcessingStatusCardProps = {
  creatingSession: boolean
  currentStep: number
  error: {
    message: string
    retryable: boolean
    code: string | null
    action: 'upload' | 'dashboard'
  } | null
  filename: string
  handleErrorAction: () => void
  notice: string | null
  progress: number
  stats: ProcessingStats | null
  statusLabel: string
  steps: ProcessingStep[]
  t: TranslateFn
}

export const ProcessingStatusCard = ({
  creatingSession,
  currentStep,
  error,
  filename,
  handleErrorAction,
  notice,
  progress,
  stats,
  statusLabel,
  steps,
  t,
}: ProcessingStatusCardProps) => (
  <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
    <div className="text-center">
      {error && (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500">
          <HiOutlineExclamationCircle className="h-8 w-8" />
        </div>
      )}

      <h1 className="mb-2 text-2xl font-medium tracking-tight text-neutral-900">
        {error ? t('processing.failedTitle') : t('processing.title')}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">{filename}</p>

      {!error && (
        <div className="mb-8 inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-4 py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-900">{statusLabel}</p>
        </div>
      )}

      {!error && notice && (
        <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-8 rounded-md border border-red-100 bg-red-50 p-4 text-left text-sm text-red-700">
          {error.message}
        </div>
      )}

      {error && notice && (
        <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
          {notice}
        </div>
      )}

      {stats && !error && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.concepts_extracted}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('processing.stats.extracted')}</div>
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.concepts_after_merge}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('processing.stats.afterMerge')}</div>
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.relations_verified}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('processing.stats.relations')}</div>
          </div>
        </div>
      )}

      {!error && (
        <div className="mx-auto mb-8 max-w-sm space-y-4 text-left">
          {steps.map((step) => {
            const isCompleted = step.id < currentStep
            const isActive = step.id === currentStep

            return (
              <div key={step.id} className="group flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                    isCompleted
                      ? 'bg-brand-trust text-white'
                      : isActive
                        ? 'border border-brand-action bg-orange-50'
                        : 'border border-neutral-200 bg-neutral-50'
                  }`}
                >
                  {isCompleted ? <HiCheck className="h-3 w-3" /> : null}
                  {isActive ? <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-action" /> : null}
                </div>
                <span
                  className={`text-sm transition-colors duration-200 ${
                    isCompleted
                      ? 'font-medium text-neutral-900'
                      : isActive
                        ? 'font-semibold text-neutral-900'
                        : 'text-neutral-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {creatingSession && (
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-sm font-medium text-neutral-900">
          <Spinner size="sm" />
          {t('processing.creatingSession')}
        </div>
      )}

      {!error && (
        <div className="relative pt-4">
          <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <span>{t('processing.progress')}</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-trust transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={handleErrorAction} className="h-auto rounded-md border-neutral-200 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-50">
            <HiOutlineArrowLeft className="mr-2 h-4 w-4" />
            {error.action === 'dashboard' ? t('processing.goToDashboard') : t('processing.tryAgain')}
          </Button>
        </div>
      )}
    </div>
  </div>
)

export const ProcessingTipCard = ({ t }: { t: TranslateFn }) => (
  <div className="mx-auto mt-6 flex w-full items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-xs text-neutral-600 shadow-sm">
    <HiOutlineSparkles className="h-4 w-4 flex-shrink-0 text-neutral-400" />
    <p>
      <strong className="text-neutral-900">{t('processing.didYouKnow')}</strong> {t('processing.didYouKnowDescription')}
    </p>
  </div>
)

export const ProcessingGraphCard = ({
  partialGraph,
  t,
}: {
  partialGraph: PipelineJobStatus['partial_graph']
  t: TranslateFn
}) => (
  <div className="relative hidden h-[600px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:flex lg:w-[55%]">
    <div className="pointer-events-none absolute left-6 top-6 z-10">
      <h3 className="text-sm font-medium tracking-wide text-neutral-900">{t('processing.knowledgeGraph')}</h3>
      <p className="mt-0.5 text-xs text-neutral-500">{t('processing.visualizingStructures')}</p>
    </div>
    <ProcessingGraphPanel partialGraph={partialGraph} />
  </div>
)
