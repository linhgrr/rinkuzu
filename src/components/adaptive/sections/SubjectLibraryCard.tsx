'use client';

import Image from 'next/image';
import { memo } from 'react';
import { Button } from '@/components/ui/Button';
import {
  HiOutlineBookOpen,
  HiOutlineRefresh,
  HiOutlineTrash,
  HiOutlineX,
} from '@/components/icons';
import type { DashboardSubject } from '@/features/adaptive/lib/dashboard-view-model';
import type { PipelineJobHistoryItem, TranslateFn } from '@/features/adaptive/types';

type SubjectLibraryCardProps = {
  subject: DashboardSubject;
  loading: boolean;
  deleting: boolean;
  imageUrl?: string;
  onOpenSubject: (jobId: string) => void;
  onDelete: (job: PipelineJobHistoryItem) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  busy?: boolean;
  t: TranslateFn;
};

/** Format etaSeconds into a compact human-readable string. */
function formatEta(etaSeconds: number): string {
  if (etaSeconds < 60) return `~${Math.round(etaSeconds)}s`;
  const minutes = Math.round(etaSeconds / 60);
  return `~${minutes}m`;
}

export const SubjectLibraryCard = memo(function SubjectLibraryCard({
  subject,
  loading,
  deleting,
  onOpenSubject,
  onDelete,
  onRetry,
  onCancel,
  busy = false,
  imageUrl,
  t,
}: SubjectLibraryCardProps) {
  const { runtime } = subject;
  const progressBarClass = 'bg-brand-trust';

  const isProcessing = runtime.kind === 'processing';
  const isRetryable = runtime.kind === 'retryable';

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <div className="mb-4">
        <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={subject.displayTitle}
              width={480}
              height={320}
              className="h-full w-full object-cover opacity-70"
              sizes="(min-width: 1024px) 22rem, (min-width: 768px) 50vw, 100vw"
            />
          ) : (
            <HiOutlineBookOpen className="size-12 text-neutral-300" />
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="truncate text-lg font-semibold text-neutral-900"
              title={subject.displayTitle}
            >
              {subject.displayTitle}
            </h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-600">
              {subject.lastOpenedLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(subject)}
            disabled={loading || deleting}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            aria-label={t('deleteMaterial')}
            title={t('deleteMaterial')}
          >
            <HiOutlineTrash className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        {isProcessing && (
          <>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-brand-trust">
              <span>{runtime.progressPercent}%</span>
              <span className="truncate pl-2 text-neutral-500">{runtime.stageLabel}</span>
            </div>
            <div className="mb-1 h-1.5 w-full rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${progressBarClass} transition-all duration-500`}
                style={{ width: `${runtime.progressPercent}%` }}
              />
            </div>
            {runtime.etaSeconds != null && (
              <p className="mb-4 text-[10px] text-neutral-400">
                {t('processingEta', { eta: formatEta(runtime.etaSeconds) })}
              </p>
            )}
            {!runtime.etaSeconds && <div className="mb-4" />}
            <Button
              onClick={() => onCancel?.(subject.job_id)}
              disabled={busy}
              aria-label={t('cancelProcessing')}
              className="w-full rounded-full bg-neutral-100 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <HiOutlineX className="mr-1.5 size-4" />
              {t('cancelProcessing')}
            </Button>
          </>
        )}

        {isRetryable && (
          <>
            <p className="mb-4 text-xs text-red-500">
              {t('processingFailed')}: {runtime.message}
            </p>
            <Button
              onClick={() => onRetry?.(subject.job_id)}
              disabled={busy}
              aria-label={t('retryProcessing')}
              className="w-full rounded-full bg-neutral-100 text-sm font-bold text-brand-trust hover:bg-brand-trust hover:text-white"
            >
              <HiOutlineRefresh className="mr-1.5 size-4" />
              {t('retryProcessing')}
            </Button>
          </>
        )}

        {runtime.kind === 'ready' && (
          <>
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-brand-trust">
              <span>{subject.metrics.progressPercent}%</span>
              <span>{subject.progressLabel}</span>
            </div>
            <div className="mb-6 h-1.5 w-full rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${progressBarClass}`}
                style={{ width: `${subject.metrics.progressPercent}%` }}
              />
            </div>
            <Button
              onClick={() => onOpenSubject(subject.job_id)}
              disabled={loading}
              className="w-full rounded-full bg-neutral-100 text-sm font-bold text-brand-trust hover:bg-brand-trust hover:text-white"
            >
              {loading ? t('creatingSession') : subject.ctaLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
});
