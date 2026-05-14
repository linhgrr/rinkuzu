'use client';

import { SparklesText } from '@/components/ui/sparkles-text';
import { HiOutlineLightningBolt, HiOutlineClock } from '@/components/icons';
import type { TranslateFn } from '@/features/adaptive-learning/types';

type DashboardHeaderProps = {
  apiOnline: boolean | null;
  dailyGoalProgress: { current: number; total: number; percent: number };
  error: string | null;
  streakDays: number;
  t: TranslateFn;
};

const DashboardStatusPill = ({ tone, text }: { tone: 'error' | 'warning'; text: string }) => (
  <div
    className={`inline-flex min-h-[28px] items-center gap-2 rounded-full px-3 text-[13px] font-semibold ${
      tone === 'error'
        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
        : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    }`}
  >
    <span className={`h-2 w-2 rounded-full ${tone === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
    {text}
  </div>
);

export const DashboardHeader = ({
  apiOnline,
  dailyGoalProgress,
  error,
  streakDays,
  t,
}: DashboardHeaderProps) => (
  <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
    <div>
      <SparklesText
        text={t('brandTitle')}
        sparklesCount={9}
        colors={{ first: '#8B5CF6', second: '#F472B6' }}
        className="text-4xl font-extrabold tracking-tight text-[#3b2ca5] md:text-5xl"
      />
      <p className="mt-2 text-lg font-medium text-neutral-600">{t('brandSubtitle')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {apiOnline === false && (
          <DashboardStatusPill tone="warning" text={t('connectionLimited')} />
        )}
        {error && <DashboardStatusPill tone="error" text={error} />}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#f8c56a] to-[#f39a2f] shadow-md">
          <HiOutlineLightningBolt className="size-3.5 text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-neutral-900">
          {t('dayStreak', { count: streakDays })}
        </span>
      </div>
      <div className="flex min-w-[9.5rem] items-center gap-3 rounded-full border border-neutral-300/60 bg-white px-4 py-2.5 shadow-sm">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#45d2be] to-[#1cb0a2] shadow-md">
          <HiOutlineClock className="size-3.5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-600">
            {t('dailyGoalProgress', {
              current: dailyGoalProgress.current,
              total: dailyGoalProgress.total,
            })}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-trust"
              style={{ width: `${dailyGoalProgress.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);
