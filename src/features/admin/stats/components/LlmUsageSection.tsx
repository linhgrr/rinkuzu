'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { formatVndCurrency } from '@/lib/formatters';
import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';
import type {
  LlmUsageBreakdownRow,
  LlmUsageViewModel,
  LlmUsageWindow,
} from '@/features/admin/stats/types/llm-usage-view-model';
import { LlmCostDonutChart } from '@/features/admin/stats/components/charts/LlmCostDonutChart';
import { LlmUsageTrendChart } from '@/features/admin/stats/components/charts/LlmUsageTrendChart';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function UsageAnalysisCard({ data, t }: { data: LlmUsageViewModel; t: TranslateFn }) {
  const analysis = data.analysis;
  const rows = [
    {
      label: t('llmUsageAvgTokensPerCall'),
      value: Math.round(analysis.averageTokensPerCall).toLocaleString(),
    },
    {
      label: t('llmUsageAvgCostPerCall'),
      value: `$${analysis.averageCostUsdPerCall.toFixed(4)}`,
    },
    {
      label: t('llmUsageTopUser'),
      value: `${analysis.topUserId} · $${analysis.topUserCostUsd.toFixed(4)}`,
    },
    {
      label: t('llmUsageTopAction'),
      value: `${analysis.topAction} · ${formatPercent(analysis.topActionCostShare)}`,
    },
    {
      label: t('llmUsageTopModel'),
      value: `${analysis.topModel} · ${formatPercent(analysis.topModelCostShare)}`,
    },
  ];

  return (
    <Card>
      <CardHeader className="px-5 pt-5">
        <CardTitle>{t('llmUsageAnalysisTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-neutral-500">{row.label}</dt>
              <dd className="mt-1 break-all font-medium text-neutral-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  title,
  rows,
  t,
  showCostChart = false,
}: {
  title: string;
  rows: LlmUsageBreakdownRow[];
  t: TranslateFn;
  showCostChart?: boolean;
}) {
  const totalCost = rows.reduce((sum, row) => sum + row.costUsd, 0);

  return (
    <Card>
      <CardHeader className="px-5 pt-5">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {showCostChart ? (
          <LlmCostDonutChart
            data={rows.map((row) => ({ name: row.key, value: row.costUsd }))}
            centerLabel={t('llmUsageTotalCost')}
            centerValue={`$${totalCost.toFixed(4)}`}
            label={title}
            valueFormatter={(value) => `$${value.toFixed(4)}`}
          />
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageColKey')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCalls')}</th>
                <th className="pb-2 text-right">{t('llmUsageColTokens')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-[var(--border-default)]">
                  <td className="py-1.5">{row.key}</td>
                  <td className="py-1.5 text-right">{row.calls.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.totalTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function LlmUsageLoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent>
        <p className="py-3 text-sm text-neutral-500">{label}</p>
      </CardContent>
    </Card>
  );
}

export function LlmUsageSection() {
  const t = useTranslations('admin');
  const [data, setData] = useState<LlmUsageViewModel | null>(null);
  const [window, setWindow] = useState<LlmUsageWindow>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchLlmUsageViewModel(window, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [window]);

  const changeWindow = (nextWindow: LlmUsageWindow) => {
    if (nextWindow === window) return;
    setLoading(true);
    setError(false);
    setWindow(nextWindow);
  };

  if (error && !data) {
    return <LlmUsageLoadingCard label={t('llmUsageError')} />;
  }
  if (!data) {
    return <LlmUsageLoadingCard label={t('llmUsageLoading')} />;
  }

  return (
    <section className="space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {t('llmUsageTitle', { days: data.windowDays })}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{t('llmUsagePrivacyNote')}</p>
        </div>
        <div className="w-36">
          <Select
            label={t('llmUsageWindow')}
            value={window}
            onChange={(event) => changeWindow(event.target.value as LlmUsageWindow)}
            selectSize="sm"
          >
            <option value="7d">{t('period7d')}</option>
            <option value="30d">{t('period30d')}</option>
            <option value="90d">{t('period90d')}</option>
            <option value="180d">{t('period180d')}</option>
          </Select>
        </div>
      </div>
      {error ? <p className="text-sm text-error">{t('llmUsageError')}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageTotalCost')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{formatVndCurrency(data.totalCostVnd)}</p>
            <p className="text-sm text-neutral-500">${data.totalCostUsd.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageTotalTokens')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{data.totalTokens.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">
              {t('llmUsageTokenSplit', {
                input: data.inputTokens.toLocaleString(),
                output: data.outputTokens.toLocaleString(),
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageRecordedCalls')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{data.calls.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageActiveUsers')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{data.analysis.activeUsers.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="px-5 pt-5">
          <CardTitle>{t('llmUsageDailyTrend')}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <LlmUsageTrendChart
            data={data.daily}
            labels={{
              chart: t('llmUsageDailyTrend'),
              tokens: t('llmUsageColTokens'),
              cost: t('llmUsageColCost'),
              empty: t('noChartData'),
            }}
          />
        </CardContent>
      </Card>
      <UsageAnalysisCard data={data} t={t} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable title={t('llmUsageByAction')} rows={data.byAction} t={t} showCostChart />
        <BreakdownTable title={t('llmUsageByModel')} rows={data.byModel} t={t} showCostChart />
        <BreakdownTable title={t('llmUsageByUser')} rows={data.byUser} t={t} />
      </div>
    </section>
  );
}
