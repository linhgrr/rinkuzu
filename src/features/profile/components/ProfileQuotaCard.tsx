'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineChartBar } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useEntitlementSnapshot } from '@/hooks/useEntitlementSnapshot';
import type {
  EntitlementWindowSnapshot,
  MeteredCapability,
  RateWindow,
} from '@/types/entitlements';

const CAPABILITIES: MeteredCapability[] = [
  'ask_rin_chan',
  'quiz_extract',
  'adaptive_pipeline',
  'adaptive_generation',
];

interface ProfileQuotaCardProps {
  variant?: 'summary' | 'full';
}

function getPrimaryWindow(windows: EntitlementWindowSnapshot[]) {
  return (
    windows.find((window) => window.window === 'day') ??
    windows.find((window) => window.window === 'month') ??
    windows[0]
  );
}

function QuotaWindow({ item, label }: { item: EntitlementWindowSnapshot; label: string }) {
  const percent = Math.min(100, Math.max(0, (item.used / item.limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium tabular-nums text-neutral-700">
          {item.used.toLocaleString()} / {item.limit.toLocaleString()}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={item.limit}
        aria-valuenow={Math.min(item.used, item.limit)}
      >
        <div
          className={`h-full rounded-full ${percent >= 100 ? 'bg-red-500' : 'bg-brand-trust'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ProfileQuotaCard({ variant = 'full' }: ProfileQuotaCardProps) {
  const t = useTranslations('profile');
  const { data, error, isLoading, mutate } = useEntitlementSnapshot();
  const capabilityLabels: Record<MeteredCapability, string> = {
    ask_rin_chan: t('quotaAskRin'),
    quiz_extract: t('quotaQuizExtract'),
    adaptive_pipeline: t('quotaAdaptivePipeline'),
    adaptive_generation: t('quotaAdaptiveGeneration'),
  };
  const windowLabels: Record<RateWindow, string> = {
    minute: t('quotaPerMinute'),
    day: t('quotaPerDay'),
    month: t('quotaPerMonth'),
  };
  const isSummary = variant === 'summary';

  return (
    <Card className="overflow-hidden p-0 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-line/50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <HiOutlineChartBar className="size-5 text-brand-trust" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('quotaTitle')}</h2>
            <p className="text-xs text-neutral-500">{t('quotaDescription')}</p>
          </div>
        </div>
        {data ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold uppercase text-neutral-600">
            {data.tier === 'premium' ? t('premiumPlan') : t('freePlan')}
          </span>
        ) : null}
      </div>
      <div className="p-4 sm:p-6">
        {isLoading ? <p className="text-sm text-neutral-500">{t('quotaLoading')}</p> : null}
        {error ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-600">{t('quotaError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void mutate()}>
              {t('quotaRetry')}
            </Button>
          </div>
        ) : null}
        {data ? (
          <div className={isSummary ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
            {CAPABILITIES.map((capability) => {
              const quota = data.capabilities[capability];
              if (quota.kind !== 'metered') return null;
              const visibleWindows = isSummary
                ? [getPrimaryWindow(quota.windows)].filter(
                    (window): window is EntitlementWindowSnapshot => window !== undefined,
                  )
                : quota.windows;
              return (
                <div
                  key={capability}
                  className={
                    isSummary
                      ? 'rounded-xl bg-neutral-50 p-3.5'
                      : 'rounded-xl border border-line/50 p-4'
                  }
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {capabilityLabels[capability]}
                    </h3>
                    {quota.unmetered ? (
                      <span className="text-xs font-medium text-brand-trust">
                        {t('quotaUnlimited')}
                      </span>
                    ) : null}
                  </div>
                  {quota.unmetered ? null : (
                    <div className="space-y-3">
                      {visibleWindows.map((window) => (
                        <QuotaWindow
                          key={window.window}
                          item={window}
                          label={windowLabels[window.window]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
