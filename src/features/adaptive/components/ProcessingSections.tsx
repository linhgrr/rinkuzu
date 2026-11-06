'use client';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  HiCheck,
  HiOutlineArrowLeft,
  HiOutlineCloudUpload,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiX,
} from 'react-icons/hi';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type {
  ProcessingErrorState,
  ProcessingStats,
  ProcessingStep,
} from '@/features/adaptive/hooks/use-processing-state';

type ProcessingFailureActions = {
  /** The failed job can be re-run in place: the primary action is "Try again". */
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
  onUploadAgain: () => void;
  onBackToLibrary: () => void;
};

type ProcessingStatusCardProps = ProcessingFailureActions & {
  creatingSession: boolean;
  currentStep: number;
  error: ProcessingErrorState | null;
  /** Step the job failed at; the step list stays visible with that step marked (RIN-1004). */
  failedStep: number | null;
  filename: string;
  notice: string | null;
  progress: number;
  stats: ProcessingStats | null;
  statusLabel: string;
  steps: ProcessingStep[];
  t: TranslateFn;
};

type StepListProps = {
  currentStep: number;
  failedStep: number | null;
  steps: ProcessingStep[];
  t: TranslateFn;
};

const ProcessingStepList = ({ currentStep, failedStep, steps, t }: StepListProps) => (
  <ol className="mx-auto mb-8 max-w-sm space-y-4 text-left">
    {steps.map((step) => {
      const reached = failedStep ?? currentStep;
      const isFailed = failedStep === step.id;
      const isCompleted = step.id < reached;
      const isActive = failedStep === null && step.id === currentStep;

      return (
        <li
          key={step.id}
          className="group flex items-center gap-3"
          data-step-state={
            isFailed ? 'failed' : isCompleted ? 'done' : isActive ? 'active' : 'todo'
          }
        >
          <div
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
              isFailed
                ? 'bg-destructive text-white'
                : isCompleted
                  ? 'bg-brand-trust text-white'
                  : isActive
                    ? 'border border-brand-action bg-orange-50'
                    : 'border border-line bg-neutral-50'
            }`}
          >
            {isFailed ? <HiX aria-hidden="true" className="size-3" /> : null}
            {isCompleted ? <HiCheck className="size-3" /> : null}
            {isActive ? (
              <div className="size-1.5 animate-pulse rounded-full bg-brand-action" />
            ) : null}
          </div>
          <span
            className={`text-sm transition-colors duration-200 ${
              isFailed
                ? 'font-semibold text-destructive'
                : isCompleted
                  ? 'font-medium text-neutral-900'
                  : isActive
                    ? 'font-semibold text-neutral-900'
                    : 'text-neutral-400'
            }`}
          >
            {step.label}
            {isFailed ? <span className="sr-only"> ({t('processing.stepFailed')})</span> : null}
          </span>
        </li>
      );
    })}
  </ol>
);

const ACTION_BUTTON_CLASS = 'min-h-11 w-full gap-2 px-6 text-sm font-medium sm:w-auto';

const ProcessingFailureButtons = ({
  action,
  canRetry,
  retrying,
  onRetry,
  onUploadAgain,
  onBackToLibrary,
  t,
}: ProcessingFailureActions & { action: ProcessingErrorState['action']; t: TranslateFn }) => {
  const backToLibrary = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} onClick={onBackToLibrary} className={ACTION_BUTTON_CLASS}>
      <HiOutlineArrowLeft data-icon="back" aria-hidden="true" className="size-4" />
      {t('processing.backToLibrary')}
    </Button>
  );
  // Label and icon say what the button does (RIN-809): upload opens the upload form for a
  // new file; only "Try again" re-runs this job.
  const uploadAgain = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} onClick={onUploadAgain} className={ACTION_BUTTON_CLASS}>
      <HiOutlineCloudUpload data-icon="upload" aria-hidden="true" className="size-4" />
      {t('processing.uploadAgain')}
    </Button>
  );

  return (
    <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
      {action === 'dashboard' ? (
        <>
          {uploadAgain('secondary')}
          {backToLibrary('primary')}
        </>
      ) : (
        <>
          {backToLibrary('secondary')}
          {canRetry ? (
            <Button
              variant="primary"
              onClick={onRetry}
              loading={retrying}
              className={ACTION_BUTTON_CLASS}
            >
              <HiOutlineRefresh data-icon="retry" aria-hidden="true" className="size-4" />
              {t('processing.tryAgain')}
            </Button>
          ) : (
            uploadAgain('primary')
          )}
        </>
      )}
    </div>
  );
};

export const ProcessingStatusCard = ({
  canRetry,
  creatingSession,
  currentStep,
  error,
  failedStep,
  filename,
  notice,
  onBackToLibrary,
  onRetry,
  onUploadAgain,
  retrying,
  progress,
  stats,
  statusLabel,
  steps,
  t,
}: ProcessingStatusCardProps) => (
  <div className="relative overflow-hidden rounded-xl border border-line bg-white p-8 shadow-sm md:p-10">
    <div className="text-center">
      {error && (
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500">
          <HiOutlineExclamationCircle className="size-8" />
        </div>
      )}

      <h1 className="mb-2 text-2xl font-medium tracking-tight text-neutral-900">
        {error ? t('processing.failedTitle') : t('processing.title')}
      </h1>
      <p className="mb-6 text-sm text-neutral-500 [overflow-wrap:anywhere]">{filename}</p>

      {!error && (
        <div className="mb-8 inline-flex items-center rounded-md border border-line bg-neutral-50 px-4 py-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-900">
            {statusLabel}
          </p>
        </div>
      )}

      {(error || notice) && (
        <div
          className={`mb-8 rounded-md border p-4 text-left text-sm ${
            error
              ? 'border-red-100 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {/* eslint-disable-next-line no-restricted-syntax -- ProcessingErrorState.message is localized copy, never server text (RIN-754) */}
          {error ? error.message : notice}
          {error && notice ? <p className="mt-2 text-amber-800">{notice}</p> : null}
        </div>
      )}

      {stats && !error && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-line/50 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.concepts_extracted}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
              {t('processing.stats.extracted')}
            </div>
          </div>
          <div className="rounded-md border border-line/50 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.concepts_after_merge}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
              {t('processing.stats.afterMerge')}
            </div>
          </div>
          <div className="rounded-md border border-line/50 bg-neutral-50 p-3 text-center">
            <div className="text-xl font-mono text-neutral-900">{stats.relations_accepted}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
              {t('processing.stats.relations')}
            </div>
          </div>
        </div>
      )}

      {(!error || failedStep !== null) && (
        <ProcessingStepList currentStep={currentStep} failedStep={failedStep} steps={steps} t={t} />
      )}

      {creatingSession && (
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-sm font-medium text-neutral-900">
          <Spinner size="sm" />
          {t('processing.creatingSession')}
        </div>
      )}

      {!error && (
        <div className="relative pt-4">
          <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-neutral-500">
            <span>{t('processing.progress')}</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-line bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-trust transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <ProcessingFailureButtons
          action={error.action}
          canRetry={canRetry}
          retrying={retrying}
          onRetry={onRetry}
          onUploadAgain={onUploadAgain}
          onBackToLibrary={onBackToLibrary}
          t={t}
        />
      )}
    </div>
  </div>
);
