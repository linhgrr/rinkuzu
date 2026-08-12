'use client';

import { useState } from 'react';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEye,
  HiOutlineRefresh,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import styles from './AdaptiveDashboardLayout.module.css';

type LibraryProps = {
  subjects: DashboardSubject[];
  loading: boolean;
  loadingJobId: string | null;
  deletingJobId: string | null;
  onOpenSubject: (jobId: string) => void;
  onViewProcessing: (subject: DashboardSubject) => void;
  onDelete: (subject: DashboardSubject) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  busyJobId?: string | null;
  t: TranslateFn;
};

function getCardState(subject: DashboardSubject, t: TranslateFn) {
  if (subject.runtime.kind === 'processing') {
    return {
      label: t('statusProcessing'),
      badge: 'bg-orange-50 text-orange-700',
      progress: subject.runtime.progressPercent,
    };
  }
  if (subject.runtime.kind === 'retryable') {
    return { label: t('statusNotStarted'), badge: 'bg-neutral-100 text-neutral-500', progress: 0 };
  }

  // Exercise history is the source of truth for the pill: a subject the learner
  // has practised is In progress/Completed even when mastery hasn't moved yet.
  const { exercise } = subject;
  if (exercise) {
    if (exercise.status === 'completed' || exercise.progressPercent >= 100) {
      return { label: t('statusCompleted'), badge: 'bg-green-50 text-green-600', progress: 100 };
    }
    return {
      label: t('statusInProgress'),
      badge: 'bg-badge-cool text-blue-600',
      progress: exercise.progressPercent,
    };
  }

  // No exercise history joined (e.g. explore page) — fall back to mastery.
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

export function SubjectCard({
  subject,
  loading,
  deleting,
  busy,
  onOpenSubject,
  onViewProcessing,
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
  onViewProcessing?: (subject: DashboardSubject) => void;
  onDelete?: (subject: DashboardSubject) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  t: TranslateFn;
}) {
  const state = getCardState(subject, t);
  const canOpen = subject.runtime.kind === 'ready';
  const openLabel = subject.exercise?.totalAnswered ? t('continueLearning') : subject.ctaLabel;

  return (
    <article
      className={cn(
        styles['libraryCard'],
        'group relative flex flex-col rounded-xl border border-accent-warm/50 bg-surface-warm p-4 font-home text-ink transition-[transform,box-shadow]',
        canOpen && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-accent',
      )}
    >
      {canOpen ? (
        <ButtonBase
          type="button"
          className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => onOpenSubject(subject.jobId)}
          disabled={loading}
          aria-label={`${openLabel}: ${subject.displayTitle}`}
        />
      ) : null}
      <div className="pointer-events-none relative flex items-start justify-between gap-2">
        <span className={cn('rounded-md px-2 py-1 text-sm font-semibold', state.badge)}>
          {state.label}
        </span>
        {onDelete ? (
          <ButtonBase
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
          </ButtonBase>
        ) : null}
      </div>

      <h3
        className="pointer-events-none relative mt-3 line-clamp-2 min-h-11 text-base font-semibold leading-snug"
        title={subject.displayTitle}
      >
        {subject.displayTitle}
      </h3>

      <div className="pointer-events-none relative mt-auto">
        {subject.runtime.kind === 'retryable' ? (
          <ButtonBase
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onRetry?.(subject.jobId);
            }}
            className="pointer-events-auto mb-3 flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
          >
            <HiOutlineRefresh className="size-4" /> {t('retryProcessing')}
          </ButtonBase>
        ) : null}
        {subject.runtime.kind === 'processing' ? (
          <div className="pointer-events-auto mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onViewProcessing?.(subject);
              }}
              className="min-h-11 bg-transparent px-0 text-sm font-semibold text-accent hover:text-accent-hover"
            >
              <HiOutlineEye className="size-4" aria-hidden="true" /> {t('viewProcessing')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onCancel?.(subject.jobId);
              }}
              className="min-h-11 bg-transparent px-0 text-sm font-semibold text-red-600"
            >
              <HiOutlineX className="size-4" aria-hidden="true" /> {t('cancelProcessing')}
            </Button>
          </div>
        ) : null}
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>
            {subject.runtime.kind === 'processing' ? t('processingProgress') : t('progressLabel')}
          </span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-progress-track">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-3"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <p className="mt-4 line-clamp-2 min-h-10 text-sm text-ink-muted">
          {subject.runtime.kind === 'processing'
            ? subject.runtime.stageLabel
            : subject.lastOpenedLabel}
        </p>
      </div>
    </article>
  );
}

export function LibraryCardSkeleton() {
  return (
    <Skeleton
      className={cn(
        styles['libraryCard'],
        'flex flex-col rounded-xl border border-accent-warm/30 p-4',
      )}
    >
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
  onViewProcessing,
  onDelete,
  onRetry,
  onCancel,
  busyJobId,
  t,
}: LibraryProps) => {
  const [showAll, setShowAll] = useState(false);
  const visibleSubjects = showAll ? subjects : subjects.slice(0, 8);

  return (
    <SurfaceCard
      className={cn(
        styles['librarySection'],
        'flex flex-col gap-5 rounded-2xl p-4 sm:gap-6 sm:p-5',
      )}
    >
      <SectionHeading title={t('knowledgeLibrary')} subtitle={t('knowledgeLibraryFigmaSubtitle')} />
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 min-[1500px]:grid-cols-4"
        aria-busy={loading}
      >
        {loading && subjects.length === 0
          ? Array.from({ length: 8 }).map((_, index) => <LibraryCardSkeleton key={index} />)
          : visibleSubjects.map((subject) => (
              <SubjectCard
                key={subject.jobId}
                subject={subject}
                loading={loadingJobId === subject.jobId}
                deleting={deletingJobId === subject.jobId}
                busy={busyJobId === subject.jobId}
                onOpenSubject={onOpenSubject}
                onViewProcessing={onViewProcessing}
                onDelete={onDelete}
                {...(onRetry !== undefined ? { onRetry } : {})}
                {...(onCancel !== undefined ? { onCancel } : {})}
                t={t}
              />
            ))}
      </div>
      {!loading && subjects.length > 8 ? (
        <Button
          variant="ghost"
          onClick={() => setShowAll((current) => !current)}
          aria-expanded={showAll}
          className="mx-auto min-h-11 rounded-full px-4 font-home text-sm font-semibold text-ink-strong hover:bg-accent-soft/30 hover:text-accent"
        >
          {showAll ? t('showLess') : t('viewAll')}
          {showAll ? (
            <HiOutlineChevronUp className="size-5" aria-hidden="true" />
          ) : (
            <HiOutlineChevronDown className="size-5" aria-hidden="true" />
          )}
        </Button>
      ) : null}
      {!loading && subjects.length === 0 ? (
        <p className="m-auto font-home text-base text-ink-muted">{t('noDocumentsDescription')}</p>
      ) : null}
    </SurfaceCard>
  );
};
