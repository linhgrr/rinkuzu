'use client';

import { HiOutlineRefresh, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import type { TranslateFn } from '@/features/adaptive/types/learning';

type LibraryProps = {
  subjects: DashboardSubject[];
  loading: boolean;
  loadingJobId: string | null;
  deletingJobId: string | null;
  onOpenSubject: (jobId: string) => void;
  onDelete: (subject: DashboardSubject) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  busyJobId?: string | null;
  t: TranslateFn;
};

function getCardState(subject: DashboardSubject, t: TranslateFn) {
  if (subject.runtime.kind === 'processing') {
    return {
      label: t('statusInProgress'),
      badge: 'bg-badge-cool text-blue-600',
      progress: subject.runtime.progressPercent,
    };
  }
  if (subject.runtime.kind === 'retryable') {
    return { label: t('statusNotStarted'), badge: 'bg-neutral-100 text-neutral-500', progress: 0 };
  }
  if (subject.metrics.progressPercent >= 100) {
    return { label: t('statusCompleted'), badge: 'bg-green-50 text-green-600', progress: 100 };
  }
  if (subject.metrics.progressPercent > 0) {
    return {
      label: t('statusInProgress'),
      badge: 'bg-badge-cool text-blue-600',
      progress: subject.metrics.progressPercent,
    };
  }
  return { label: t('statusNotStarted'), badge: 'bg-neutral-100 text-neutral-500', progress: 0 };
}

function SubjectCard({
  subject,
  loading,
  deleting,
  busy,
  onOpenSubject,
  onDelete,
  onRetry,
  onCancel,
  t,
}: {
  subject: DashboardSubject;
  loading: boolean;
  deleting: boolean;
  busy: boolean;
  onOpenSubject: (jobId: string) => void;
  onDelete: (subject: DashboardSubject) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  t: TranslateFn;
}) {
  const state = getCardState(subject, t);
  const canOpen = subject.runtime.kind === 'ready';

  return (
    <article
      className={cn(
        'group relative flex min-h-[196px] flex-col rounded-xl border border-accent-warm/50 bg-surface-warm p-4 font-home text-ink transition-[transform,box-shadow] sm:min-h-[212px]',
        canOpen && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-accent',
      )}
    >
      {canOpen ? (
        <button
          type="button"
          className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => onOpenSubject(subject.jobId)}
          disabled={loading}
          aria-label={`${subject.ctaLabel}: ${subject.displayTitle}`}
        />
      ) : null}
      <div className="pointer-events-none relative flex items-start justify-between gap-2">
        <span className={cn('rounded-[6px] px-2 py-1 text-sm font-semibold', state.badge)}>
          {state.label}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(subject);
          }}
          disabled={deleting}
          className="pointer-events-auto relative rounded-md p-1 text-ink-muted opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={t('deleteMaterial')}
        >
          <HiOutlineTrash className="size-4" />
        </button>
      </div>

      <h3
        className="pointer-events-none relative mt-3 line-clamp-2 min-h-11 text-base font-semibold leading-[1.4]"
        title={subject.displayTitle}
      >
        {subject.displayTitle}
      </h3>

      <div className="pointer-events-none relative mt-auto">
        {subject.runtime.kind === 'retryable' ? (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onRetry?.(subject.jobId);
            }}
            className="pointer-events-auto mb-3 flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
          >
            <HiOutlineRefresh className="size-4" /> {t('retryProcessing')}
          </button>
        ) : null}
        {subject.runtime.kind === 'processing' ? (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onCancel?.(subject.jobId);
            }}
            className="pointer-events-auto mb-3 flex items-center gap-1 text-sm font-semibold text-red-600"
          >
            <HiOutlineX className="size-4" /> {t('cancelProcessing')}
          </button>
        ) : null}
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>{t('progressLabel')}</span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-progress-track">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-3"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <p className="mt-4 text-sm text-ink-muted">{subject.lastOpenedLabel}</p>
      </div>
    </article>
  );
}

function LibraryCardSkeleton() {
  return (
    <Skeleton className="flex min-h-[196px] flex-col rounded-xl border border-accent-warm/30 p-4 sm:min-h-[212px]">
      <div className="flex items-start justify-between gap-3">
        <div className="h-7 w-24 rounded-md bg-primary-2/50" />
        <div className="size-6 rounded-md bg-primary-2/40" />
      </div>
      <div className="mt-4 h-5 w-4/5 rounded bg-primary-2/50" />
      <div className="mt-2 h-5 w-3/5 rounded bg-primary-2/40" />
      <div className="mt-auto">
        <div className="mb-2 flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-primary-2/40" />
          <div className="h-4 w-9 rounded bg-primary-2/40" />
        </div>
        <div className="h-2 w-full rounded-full bg-primary-2/50" />
        <div className="mt-4 h-4 w-28 rounded bg-primary-2/40" />
      </div>
    </Skeleton>
  );
}

export const LibrarySection = ({
  subjects,
  loading,
  loadingJobId,
  deletingJobId,
  onOpenSubject,
  onDelete,
  onRetry,
  onCancel,
  busyJobId,
  t,
}: LibraryProps) => (
  <SurfaceCard className="flex min-h-[420px] flex-col gap-5 rounded-2xl p-4 sm:min-h-[555px] sm:gap-6 sm:p-5 md:rounded-[20px]">
    <SectionHeading
      title={t('knowledgeLibrary')}
      subtitle={t('knowledgeLibraryFigmaSubtitle')}
      href="/adaptive"
      viewAllLabel={t('viewAll')}
    />
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 min-[1500px]:grid-cols-4"
      aria-busy={loading}
    >
      {loading && subjects.length === 0
        ? Array.from({ length: 8 }).map((_, index) => <LibraryCardSkeleton key={index} />)
        : subjects
            .slice(0, 8)
            .map((subject) => (
              <SubjectCard
                key={subject.jobId}
                subject={subject}
                loading={loadingJobId === subject.jobId}
                deleting={deletingJobId === subject.jobId}
                busy={busyJobId === subject.jobId}
                onOpenSubject={onOpenSubject}
                onDelete={onDelete}
                onRetry={onRetry}
                onCancel={onCancel}
                t={t}
              />
            ))}
    </div>
    {!loading && subjects.length === 0 ? (
      <p className="m-auto font-home text-base text-ink-muted">{t('noDocumentsDescription')}</p>
    ) : null}
  </SurfaceCard>
);
