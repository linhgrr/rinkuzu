'use client';

import { memo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Spinner } from '@/components/ui/Spinner';
import { HiArrowRight, HiOutlineAcademicCap } from '@/components/icons';
import type { SessionHistoryItem } from '@/features/adaptive/types';
import { formatSessionHistoryDate } from '@/features/adaptive/lib/session-history-utils';

interface SessionRowProps {
  item: SessionHistoryItem;
  onOpen: (id: string) => void;
}

const SessionRow = memo(function SessionRow({ item, onOpen }: SessionRowProps) {
  const t = useTranslations('adaptiveLearning');
  const locale = useLocale();
  const accuracy = Math.round(item.accuracy * 100);
  const grade = accuracy >= 80 ? 'A+' : accuracy >= 60 ? 'B' : 'C';
  const gradeColor =
    accuracy >= 80
      ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
      : accuracy >= 60
        ? 'border-neutral-100 bg-neutral-50 text-neutral-700'
        : 'border-neutral-100 bg-neutral-50 text-neutral-500';

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 text-left transition-colors duration-200 hover:border-neutral-800 sm:flex-row sm:items-center sm:justify-between focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
      onClick={() => onOpen(item.job_id)}
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
              title={item.subject_id || item.filename || item.job_id}
            >
              {item.subject_id || item.filename || item.job_id.substring(0, 8)}
            </span>
            {item.status === 'completed' ? (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                {t('history.completed')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                {t('history.step', { step: item.step, total: item.max_steps })}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-neutral-500">
            {formatSessionHistoryDate(item.updated_at, locale)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 sm:gap-10">
        <div className="hidden flex-col items-end md:flex">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {t('history.correct')}
          </span>
          <span className="text-sm font-mono text-neutral-900">
            {item.total_correct}/{item.total_answered}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {t('stats.averageMastery')}
          </span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-20 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              <div
                className={`h-full rounded-full ${accuracy >= 70 ? 'bg-neutral-900' : 'bg-neutral-400'}`}
                style={{ width: `${Math.round(item.avg_mastery * 100)}%` }}
              />
            </div>
            <span className="w-9 text-right font-mono text-sm text-neutral-900">
              {Math.round(item.avg_mastery * 100)}%
            </span>
          </div>
        </div>
        <div className="hidden size-8 items-center justify-center text-neutral-400 transition-colors group-hover:text-neutral-900 sm:flex">
          <HiArrowRight className="size-4" />
        </div>
      </div>
    </button>
  );
});

export const SessionHistoryLoadingState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center gap-3 py-12 text-neutral-500">
    <Spinner />
    <span className="text-sm">{message}</span>
  </div>
);

export const SessionHistoryErrorState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
    {message}
  </div>
);

export const SessionHistoryEmptyState = ({ hint, message }: { hint: string; message: string }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-neutral-400">
    <HiOutlineAcademicCap className="size-10 opacity-40" />
    <p className="text-sm">{message}</p>
    <p className="text-xs text-neutral-300">{hint}</p>
  </div>
);

export const SessionHistoryList = ({
  onOpen,
  sessions,
}: {
  onOpen: (id: string) => void;
  sessions: SessionHistoryItem[];
}) => (
  <div className="space-y-2">
    {sessions.map((item) => (
      <SessionRow key={item.job_id} item={item} onOpen={onOpen} />
    ))}
  </div>
);
