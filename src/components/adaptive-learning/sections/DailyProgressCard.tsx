'use client';

import { HiOutlineLightningBolt, HiOutlineBookOpen } from '@/components/icons';

type TranslateFn = (key: string, values?: Record<string, any>) => string;

type DailyProgressCardProps = {
  dailyGoalProgress: { current: number; total: number; percent: number };
  t: TranslateFn;
};

export const DailyProgressCard = ({ dailyGoalProgress, t }: DailyProgressCardProps) => (
  <section className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm lg:col-span-4">
    <div>
      <h2 className="mb-8 text-2xl font-extrabold tracking-tight text-neutral-900">
        {t('dailyProgressTitle')}
      </h2>
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8ff2df] to-[#57d9c9] shadow-[0_10px_20px_rgba(44,192,170,0.25)]">
            <HiOutlineLightningBolt className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
              {t('earnedToday')}
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">1,250 XP</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffcf77] to-[#f6a636] shadow-[0_10px_20px_rgba(246,166,54,0.24)]">
            <HiOutlineBookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
              {t('achievements')}
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">4 {t('unlocked')}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-8 border-t border-neutral-300/60 pt-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-neutral-900">{t('levelArchitect')}</span>
        <span className="text-xs font-medium text-neutral-600">
          {t('dailyGoalProgress', {
            current: dailyGoalProgress.current,
            total: dailyGoalProgress.total,
          })}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-brand-trust shadow-[var(--shadow-green-glow)]"
          style={{ width: `${Math.max(dailyGoalProgress.percent, 8)}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-600">{t('levelProgressHint')}</p>
    </div>
  </section>
);
