'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/Skeleton';
import { HiArrowRight, HiOutlineAcademicCap } from 'react-icons/hi';
import { formatSessionHistoryDate } from '@/features/adaptive/lib/session-history-utils';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';

interface SessionRowProps {
  item: SessionHistoryViewModel;
  onOpen: (id: string) => void;
}

interface SessionHistoryLoadingStateProps {
  message: string;
}

interface SessionHistoryErrorStateProps {
  message: string;
}

interface SessionHistoryEmptyStateProps {
  hint: string;
  message: string;
}

interface SessionHistoryListProps {
  onOpen: (id: string) => void;
  sessions: SessionHistoryViewModel[];
}

function SessionRow({ item, onOpen }: SessionRowProps) {
  const t = useTranslations('adaptiveLearning');
  const locale = useLocale();
  const grade = item.accuracyPercent >= 80 ? 'A+' : item.accuracyPercent >= 60 ? 'B' : 'C';
  const gradeColor =
    item.accuracyPercent >= 80
      ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
      : item.accuracyPercent >= 60
        ? 'border-neutral-100 bg-neutral-50 text-neutral-700'
        : 'border-neutral-100 bg-neutral-50 text-neutral-500';

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 text-left transition-colors duration-200 hover:border-neutral-800 sm:flex-row sm:items-center sm:justify-between focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
      onClick={() => onOpen(item.jobId)}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md border font-mono text-lg font-medium ${gradeColor}`}
        >
          {grade}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-3">
            <span
              className="max-w-[200px] truncate text-base font-medium text-neutral-900"
              title={item.displayTitle}
            >
              {item.displayTitle}
            </span>
            {item.status === 'completed' ? (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                {t('history.completed')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                {t('history.step', { step: item.step, total: item.maxSteps })}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-neutral-500">
            {formatSessionHistoryDate(item.updatedAt, locale)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 sm:gap-10">
        <div className="hidden flex-col items-end md:flex">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {t('history.correct')}
          </span>
          <span className="text-sm font-mono text-neutral-900">
            {item.totalCorrect}/{item.totalAnswered}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {t('stats.averageMastery')}
          </span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-20 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              <div
                className={`h-full rounded-full ${
                  item.averageMasteryPercent >= 70 ? 'bg-neutral-900' : 'bg-neutral-400'
                }`}
                style={{ width: `${item.averageMasteryPercent}%` }}
              />
            </div>
            <span className="w-9 text-right font-mono text-sm text-neutral-900">
              {item.averageMasteryPercent}%
            </span>
          </div>
        </div>
        <div className="hidden size-8 items-center justify-center text-neutral-400 transition-colors group-hover:text-neutral-900 sm:flex">
          <HiArrowRight className="size-4" />
        </div>
      </div>
    </button>
  );
}

export const SessionHistoryLoadingState = ({ message }: SessionHistoryLoadingStateProps) => (
  <div className="space-y-3 py-2" aria-busy="true" aria-label={message}>
    {Array.from({ length: 4 }, (_, index) => (
      <div key={`session-history-skeleton-${index}`} className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/5 rounded-md" />
            <Skeleton className="h-4 w-2/5 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const SessionHistoryErrorState = ({ message }: SessionHistoryErrorStateProps) => (
  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
    {message}
  </div>
);

export const SessionHistoryEmptyState = ({ hint, message }: SessionHistoryEmptyStateProps) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-neutral-400">
    <HiOutlineAcademicCap className="size-10 opacity-40" />
    <p className="text-sm">{message}</p>
    <p className="text-xs text-neutral-300">{hint}</p>
  </div>
);

export const SessionHistoryList = ({ onOpen, sessions }: SessionHistoryListProps) => (
  <div className="space-y-2">
    {sessions.map((item) => (
      <SessionRow key={item.jobId} item={item} onOpen={onOpen} />
    ))}
  </div>
);
