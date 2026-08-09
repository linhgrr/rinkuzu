'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatVndCurrency } from '@/lib/formatters';
import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';
import type {
  LlmUsageViewModel,
  LlmUsageFilters,
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
      label: t('llmUsageAvgTokensPerOperation'),
      value: Math.round(analysis.averageTokensPerOperation).toLocaleString(),
    },
    {
      label: t('llmUsageAvgCostPerOperation'),
      value: `$${analysis.averageCostUsdPerOperation.toFixed(4)}`,
    },
    {
      label: t('llmUsageSuccessRate'),
      value: formatPercent(analysis.successRate),
    },
    {
      label: t('llmUsageFallbackRate'),
      value: formatPercent(analysis.fallbackRate),
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
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle>{t('llmUsageAnalysisTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-neutral-500">{row.label}</dt>
              <dd className="mt-1 break-words font-medium text-neutral-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  title,
  breakdown,
  t,
  showCostChart = false,
}: {
  title: string;
  breakdown: LlmUsageViewModel['byAction'];
  t: TranslateFn;
  showCostChart?: boolean;
}) {
  const rows = breakdown.rows;
  const totalCost = rows.reduce((sum, row) => sum + row.costUsd, 0);

  return (
    <Card className="p-0">
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
                <th className="pb-2 text-right">{t('llmUsageColOperations')}</th>
                <th className="pb-2 text-right">{t('llmUsageColAttempts')}</th>
                <th className="pb-2 text-right">{t('llmUsageColTokens')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-[var(--border-default)]">
                  <td className="py-1.5">{row.key}</td>
                  <td className="py-1.5 text-right">{row.logicalOperations.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.physicalAttempts.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.totalTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {breakdown.truncated ? (
          <p className="mt-2 text-xs text-neutral-500">{t('llmUsageBreakdownTruncated')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LlmUsageLoadingCard({ label }: { label: string }) {
  return (
    <Card className="p-0">
      <CardContent>
        <p className="py-3 text-sm text-neutral-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function UserActionTable({ data, t }: { data: LlmUsageViewModel['byUserAction']; t: TranslateFn }) {
  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle>{t('llmUsageByUserAction')}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {data.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageUserId')}</th>
                <th className="pb-2">{t('llmUsageAction')}</th>
                <th className="pb-2 text-right">{t('llmUsageColOperations')}</th>
                <th className="pb-2 text-right">{t('llmUsageColAttempts')}</th>
                <th className="pb-2 text-right">{t('llmUsageColTokens')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.userId}:${row.action}`} className="border-t border-line">
                  <td className="py-1.5 font-mono">{row.userId}</td>
                  <td className="py-1.5">{row.action}</td>
                  <td className="py-1.5 text-right">{row.logicalOperations.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.physicalAttempts.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.totalTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.truncated ? (
          <p className="mt-2 text-xs text-neutral-500">{t('llmUsageBreakdownTruncated')}</p>
        ) : null}
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
  const [filters, setFilters] = useState<LlmUsageFilters>({});
  const [filterDraft, setFilterDraft] = useState({
    action: '',
    userId: '',
    providerId: '',
    modelId: '',
    includeNonProduct: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchLlmUsageViewModel(window, controller.signal, filters)
      .then(setData)
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, window]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(false);
    setFilters({
      ...(filterDraft.action.trim() ? { action: filterDraft.action.trim() } : {}),
      ...(filterDraft.userId.trim() ? { userId: filterDraft.userId.trim() } : {}),
      ...(filterDraft.providerId.trim() ? { providerId: filterDraft.providerId.trim() } : {}),
      ...(filterDraft.modelId.trim() ? { modelId: filterDraft.modelId.trim() } : {}),
      ...(filterDraft.includeNonProduct ? { includeNonProduct: true } : {}),
    });
  };

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
            <option value="1d">{t('period1d')}</option>
            <option value="30d">{t('period30d')}</option>
            <option value="90d">{t('period90d')}</option>
            <option value="180d">{t('period180d')}</option>
          </Select>
        </div>
      </div>
      <form
        className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-6"
        onSubmit={applyFilters}
      >
        <input
          className="h-9 rounded-lg border border-line px-3 text-sm"
          placeholder={t('llmUsageFilterAction')}
          value={filterDraft.action}
          onChange={(event) =>
            setFilterDraft((value) => ({ ...value, action: event.target.value }))
          }
        />
        <input
          className="h-9 rounded-lg border border-line px-3 text-sm"
          placeholder={t('llmUsageFilterUser')}
          value={filterDraft.userId}
          onChange={(event) =>
            setFilterDraft((value) => ({ ...value, userId: event.target.value }))
          }
        />
        <input
          className="h-9 rounded-lg border border-line px-3 text-sm"
          placeholder={t('llmUsageFilterProvider')}
          value={filterDraft.providerId}
          onChange={(event) =>
            setFilterDraft((value) => ({ ...value, providerId: event.target.value }))
          }
        />
        <input
          className="h-9 rounded-lg border border-line px-3 text-sm"
          placeholder={t('llmUsageFilterModel')}
          value={filterDraft.modelId}
          onChange={(event) =>
            setFilterDraft((value) => ({ ...value, modelId: event.target.value }))
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterDraft.includeNonProduct}
            onChange={(event) =>
              setFilterDraft((value) => ({ ...value, includeNonProduct: event.target.checked }))
            }
          />
          {t('llmUsageIncludeNonProduct')}
        </label>
        <Button type="submit" size="sm">
          {t('llmUsageApplyFilters')}
        </Button>
      </form>
      {error ? <p className="text-sm text-error">{t('llmUsageError')}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-0">
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageTotalCost')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{formatVndCurrency(data.totalCostVnd)}</p>
            <p className="text-sm text-neutral-500">${data.totalCostUsd.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
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
        <Card className="p-0">
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsageLogicalOperations')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{data.logicalOperations.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">
              {t('llmUsageOperationSplit', {
                success: data.successfulOperations.toLocaleString(),
                failed: data.failedOperations.toLocaleString(),
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="px-5 pt-5">
            <CardTitle>{t('llmUsagePhysicalAttempts')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-semibold">{data.physicalAttempts.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">
              {t('llmUsageAttemptSplit', {
                fallback: data.fallbackOperations.toLocaleString(),
                recoverable: data.recoverableFailures.toLocaleString(),
              })}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="p-0">
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
      <UserActionTable data={data.byUserAction} t={t} />
      <Card className="p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>{t('llmUsageObservabilityTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div>
              <dt className="text-neutral-500">{t('llmUsageTokenAnomalies')}</dt>
              <dd className="mt-1 font-medium">
                {data.observability.tokenAnomalies.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('llmUsageUnknownPricing')}</dt>
              <dd className="mt-1 font-medium">
                {data.observability.unknownPricing.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('llmUsagePersistenceFailures')}</dt>
              <dd className="mt-1 font-medium">
                {data.observability.persistenceFailures.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('llmUsageMissingAttribution')}</dt>
              <dd className="mt-1 font-medium">
                {data.observability.missingAttribution.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable
          title={t('llmUsageByAction')}
          breakdown={data.byAction}
          t={t}
          showCostChart
        />
        <BreakdownTable title={t('llmUsageByModel')} breakdown={data.byModel} t={t} showCostChart />
        <BreakdownTable title={t('llmUsageByProvider')} breakdown={data.byProvider} t={t} />
        <BreakdownTable title={t('llmUsageByUser')} breakdown={data.byUser} t={t} />
      </div>
    </section>
  );
}
