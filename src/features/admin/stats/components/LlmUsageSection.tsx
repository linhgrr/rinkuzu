'use client';

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatVndCurrency } from '@/lib/formatters';
import { fetchAiSettings } from '@/features/admin/ai-settings/api/ai-settings-api';
import type { AiSettingsViewModel } from '@/features/admin/ai-settings/types/ai-settings';
import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';
import type {
  LlmUsageBreakdown,
  LlmUsageFilters,
  LlmUsageViewModel,
  LlmUsageWindow,
} from '@/features/admin/stats/types/llm-usage-view-model';
import {
  LlmUsageTrendChart,
  type LlmTrendMode,
} from '@/features/admin/stats/components/charts/LlmUsageTrendChart';
import { LlmBreakdownBarChart } from '@/features/admin/stats/components/charts/LlmBreakdownBarChart';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
type DashboardTab = 'overview' | 'cost' | 'reliability' | 'users';
type LabelKind = 'action' | 'model' | 'outcome' | 'provider' | 'raw';

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatLatency(value: number): string {
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  change,
  lowerIsBetter = false,
  t,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  change?: number | null;
  lowerIsBetter?: boolean;
  t: TranslateFn;
}) {
  const improved =
    change === null || change === undefined || change === 0
      ? null
      : lowerIsBetter
        ? change < 0
        : change > 0;

  return (
    <Card className="min-w-0 p-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Icon className="size-4 shrink-0 text-brand-action" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </div>
        <p className="mt-3 break-words text-2xl font-semibold text-neutral-950">{value}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <span>{detail}</span>
          {change !== undefined ? (
            <span
              className={
                improved === null ? 'text-neutral-500' : improved ? 'text-success' : 'text-error'
              }
            >
              {change === null
                ? t('llmUsageNewVsPrevious')
                : t('llmUsageChangeVsPrevious', {
                    change: `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`,
                  })}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionInsights({
  data,
  actionLabel,
  t,
}: {
  data: LlmUsageViewModel;
  actionLabel: (value: string) => string;
  t: TranslateFn;
}) {
  const insights: Array<{ kind: 'good' | 'warning'; text: string }> = [];
  const fallbackRate = ratio(data.fallbackOperations, data.logicalOperations);
  const costChange = percentChange(data.totalCostUsd, data.previousPeriod.totalCostUsd);
  const operationChange = percentChange(
    data.logicalOperations,
    data.previousPeriod.logicalOperations,
  );

  if (data.observability.unknownPricing > 0) {
    insights.push({
      kind: 'warning',
      text: t('llmUsageInsightUnknownPricing', { count: data.observability.unknownPricing }),
    });
  }
  if (data.failedOperations > 0) {
    insights.push({
      kind: 'warning',
      text: t('llmUsageInsightFailures', {
        count: data.failedOperations,
        rate: formatPercent(ratio(data.failedOperations, data.logicalOperations)),
      }),
    });
  }
  if (fallbackRate >= 0.1) {
    insights.push({
      kind: 'warning',
      text: t('llmUsageInsightFallback', { rate: formatPercent(fallbackRate) }),
    });
  }
  if (data.analysis.topActionCostShare >= 0.5 && data.totalCostUsd > 0) {
    insights.push({
      kind: 'warning',
      text: t('llmUsageInsightConcentration', {
        action: actionLabel(data.analysis.topAction),
        share: formatPercent(data.analysis.topActionCostShare),
      }),
    });
  }
  if (
    costChange !== null &&
    operationChange !== null &&
    costChange > 0.2 &&
    operationChange < 0.1
  ) {
    insights.push({ kind: 'warning', text: t('llmUsageInsightEfficiency') });
  }
  if (insights.length === 0) {
    insights.push({ kind: 'good', text: t('llmUsageInsightHealthy') });
  }

  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-brand-action" aria-hidden="true" />
          {t('llmUsageDecisionSignals')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-5 pb-5 md:grid-cols-2">
        {insights.slice(0, 4).map((insight) => {
          const Icon = insight.kind === 'good' ? CheckCircle2 : ShieldAlert;
          return (
            <div
              key={insight.text}
              className={`flex gap-2 rounded-lg border p-3 text-sm ${
                insight.kind === 'good'
                  ? 'border-green-200 bg-green-50 text-green-900'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{insight.text}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EfficiencyTable({
  title,
  breakdown,
  labelFor,
  t,
}: {
  title: string;
  breakdown: LlmUsageBreakdown;
  labelFor: (value: string) => string;
  t: TranslateFn;
}) {
  return (
    <Card className="min-w-0 p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {breakdown.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageColKey')}</th>
                <th className="pb-2 text-right">{t('llmUsageColOperations')}</th>
                <th className="pb-2 text-right">{t('llmUsageSuccessRate')}</th>
                <th className="pb-2 text-right">{t('llmUsageFallbackRate')}</th>
                <th className="pb-2 text-right">{t('llmUsageCostPerSuccess')}</th>
                <th className="pb-2 text-right">{t('llmUsageAverageLatency')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.rows.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="max-w-64 py-2 pr-3 font-medium">
                    <span className="block break-words">{labelFor(row.key)}</span>
                  </td>
                  <td className="py-2 text-right">{row.logicalOperations.toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {formatPercent(ratio(row.successfulOperations, row.logicalOperations))}
                  </td>
                  <td className="py-2 text-right">
                    {formatPercent(ratio(row.fallbackOperations, row.logicalOperations))}
                  </td>
                  <td className="py-2 text-right">
                    ${ratio(row.costUsd, row.successfulOperations).toFixed(4)}
                  </td>
                  <td className="py-2 text-right">
                    {formatLatency(ratio(row.totalLatencyMs, row.logicalOperations))}
                  </td>
                  <td className="py-2 text-right">${row.costUsd.toFixed(4)}</td>
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

function CompactBreakdownTable({
  title,
  breakdown,
  labelFor,
  t,
}: {
  title: string;
  breakdown: LlmUsageBreakdown;
  labelFor: (value: string) => string;
  t: TranslateFn;
}) {
  return (
    <Card className="min-w-0 p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {breakdown.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageColKey')}</th>
                <th className="pb-2 text-right">{t('llmUsageColOperations')}</th>
                <th className="pb-2 text-right">{t('llmUsageColAttempts')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.rows.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="max-w-64 py-2 pr-3 font-medium">
                    <span className="block break-words">{labelFor(row.key)}</span>
                  </td>
                  <td className="py-2 text-right">{row.logicalOperations.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.physicalAttempts.toLocaleString()}</td>
                  <td className="py-2 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function ObservabilityCard({ data, t }: { data: LlmUsageViewModel; t: TranslateFn }) {
  const items = [
    [t('llmUsageTokenAnomalies'), data.observability.tokenAnomalies],
    [t('llmUsageUnknownPricing'), data.observability.unknownPricing],
    [t('llmUsageUsageUnavailable'), data.observability.usageUnavailable],
    [t('llmUsagePersistenceFailures'), data.observability.persistenceFailures],
    [t('llmUsageMissingAttribution'), data.observability.missingAttribution],
  ] as const;

  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base">{t('llmUsageObservabilityTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-5">
        {items.map(([label, value]) => (
          <div
            key={label}
            className={`rounded-lg border p-3 ${
              value > 0 ? 'border-amber-200 bg-amber-50' : 'border-line bg-neutral-50'
            }`}
          >
            <p className="text-xs text-neutral-600">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value.toLocaleString()}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UserActionTable({
  data,
  actionLabel,
  t,
}: {
  data: LlmUsageViewModel['byUserAction'];
  actionLabel: (value: string) => string;
  t: TranslateFn;
}) {
  return (
    <Card className="min-w-0 p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base">{t('llmUsageByUserAction')}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {data.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageUserId')}</th>
                <th className="pb-2">{t('llmUsageAction')}</th>
                <th className="pb-2 text-right">{t('llmUsageColOperations')}</th>
                <th className="pb-2 text-right">{t('llmUsageSuccessRate')}</th>
                <th className="pb-2 text-right">{t('llmUsageColTokens')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.userId}:${row.action}`} className="border-t border-line">
                  <td className="max-w-56 break-all py-2 pr-3 font-mono text-xs">{row.userId}</td>
                  <td className="max-w-64 break-words py-2 pr-3">{actionLabel(row.action)}</td>
                  <td className="py-2 text-right">{row.logicalOperations.toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {formatPercent(ratio(row.successfulOperations, row.logicalOperations))}
                  </td>
                  <td className="py-2 text-right">{row.totalTokens.toLocaleString()}</td>
                  <td className="py-2 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function LlmUsageSection() {
  const t = useTranslations('admin');
  const [data, setData] = useState<LlmUsageViewModel | null>(null);
  const [catalog, setCatalog] = useState<AiSettingsViewModel | null>(null);
  const [window, setWindow] = useState<LlmUsageWindow>('30d');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [trendMode, setTrendMode] = useState<LlmTrendMode>('cost');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [filters, setFilters] = useState<LlmUsageFilters>({});
  const requestKey = JSON.stringify([window, reloadVersion, filters]);
  const [requestState, setRequestState] = useState({ key: '', error: false });
  const loading = requestState.key !== requestKey;
  const error = requestState.key === requestKey && requestState.error;
  const [filterDraft, setFilterDraft] = useState({
    action: '',
    userId: '',
    providerId: '',
    modelId: '',
    includeNonProduct: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetchAiSettings(controller.signal)
      .then(setCatalog)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLlmUsageViewModel(window, controller.signal, filters)
      .then((nextData) => {
        setData(nextData);
        setRequestState({ key: requestKey, error: false });
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setRequestState({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [filters, requestKey, window]);

  const providerLabels = useMemo(
    () => new Map(catalog?.providers.map((provider) => [provider.id, provider.name]) ?? []),
    [catalog],
  );
  const modelLabels = useMemo(
    () => new Map(catalog?.models.map((model) => [model.id, model.displayName]) ?? []),
    [catalog],
  );
  const knownActions = useMemo(
    () => new Set<string>(catalog?.actions.map((definition) => definition.action) ?? []),
    [catalog],
  );
  const filteredModels = useMemo(
    () =>
      catalog?.models.filter(
        (model) => !filterDraft.providerId || model.providerId === filterDraft.providerId,
      ) ?? [],
    [catalog, filterDraft.providerId],
  );

  const actionLabel = (value: string) =>
    knownActions.has(value) ? t(`aiSettingsAction_${value}`) : value;
  const labelFor = (kind: LabelKind) => (value: string) => {
    if (kind === 'action') return actionLabel(value);
    if (kind === 'model') return modelLabels.get(value) ?? value;
    if (kind === 'provider') return providerLabels.get(value) ?? value;
    if (kind === 'outcome') {
      const labels: Record<string, string> = {
        success: t('llmUsageOutcomeSuccess'),
        recoverable_failure: t('llmUsageOutcomeRecoverableFailure'),
        terminal_failure: t('llmUsageOutcomeTerminalFailure'),
        cancelled: t('llmUsageOutcomeCancelled'),
        committed_stream_error: t('llmUsageOutcomeCommittedStreamError'),
      };
      return labels[value] ?? value;
    }
    return value;
  };

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilters({
      ...(filterDraft.action ? { action: filterDraft.action } : {}),
      ...(filterDraft.userId.trim() ? { userId: filterDraft.userId.trim() } : {}),
      ...(filterDraft.providerId ? { providerId: filterDraft.providerId } : {}),
      ...(filterDraft.modelId ? { modelId: filterDraft.modelId } : {}),
      ...(filterDraft.includeNonProduct ? { includeNonProduct: true } : {}),
    });
  };

  if (!data) {
    return (
      <Card className="p-0">
        <CardContent className="p-5 text-sm text-neutral-500" role="status">
          {error ? t('llmUsageError') : t('llmUsageLoading')}
        </CardContent>
      </Card>
    );
  }

  const previousSuccessRate = ratio(
    data.previousPeriod.successfulOperations,
    data.previousPeriod.logicalOperations,
  );
  const previousUnitCost = ratio(
    data.previousPeriod.totalCostUsd,
    data.previousPeriod.successfulOperations,
  );
  const previousLatency = ratio(
    data.previousPeriod.totalLatencyMs,
    data.previousPeriod.logicalOperations,
  );
  const tabs: Array<{ id: DashboardTab; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: t('llmUsageTabOverview'), icon: Activity },
    { id: 'cost', label: t('llmUsageTabCost'), icon: CircleDollarSign },
    { id: 'reliability', label: t('llmUsageTabReliability'), icon: Gauge },
    { id: 'users', label: t('llmUsageTabUsers'), icon: Users },
  ];

  const navigateTabs = (event: ReactKeyboardEvent<HTMLButtonElement>, current: DashboardTab) => {
    const currentIndex = tabs.findIndex((item) => item.id === current);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    setTab(nextTab.id);
    document.getElementById(`llm-usage-tab-${nextTab.id}`)?.focus();
  };

  return (
    <section className="min-w-0 space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-2">
        <div className="flex min-w-0 items-center gap-2 px-2">
          <BrainCircuit className="size-5 shrink-0 text-brand-action" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-950">
              {t('llmUsageWorkspaceTitle')}
            </h2>
            <p className="text-xs text-neutral-500">
              {t('llmUsageWindowSummary', { days: data.windowDays })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            aria-label={t('llmUsageWindow')}
            className="h-9 w-28 text-sm"
            value={window}
            onChange={(event) => setWindow(event.target.value as LlmUsageWindow)}
          >
            <option value="1d">{t('period1d')}</option>
            <option value="7d">{t('period7d')}</option>
            <option value="30d">{t('period30d')}</option>
            <option value="90d">{t('period90d')}</option>
            <option value="180d">{t('period180d')}</option>
          </Select>
          <Button
            variant={filtersOpen ? 'secondary' : 'outline'}
            size="sm"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter className="size-4" aria-hidden="true" />
            {t('llmUsageFilters')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('refresh')}
            title={t('refresh')}
            disabled={loading}
            onClick={() => setReloadVersion((value) => value + 1)}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <form
          className="grid gap-3 rounded-xl border border-line bg-white p-4 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={applyFilters}
        >
          <Select
            label={t('llmUsageFilterAction')}
            className={FIELD}
            value={filterDraft.action}
            onChange={(event) =>
              setFilterDraft((value) => ({ ...value, action: event.target.value }))
            }
          >
            <option value="">{t('llmUsageAll')}</option>
            {catalog?.actions.map((definition) => (
              <option key={definition.action} value={definition.action}>
                {actionLabel(definition.action)}
              </option>
            ))}
          </Select>
          <Select
            label={t('llmUsageFilterProvider')}
            className={FIELD}
            value={filterDraft.providerId}
            onChange={(event) =>
              setFilterDraft((value) => ({
                ...value,
                providerId: event.target.value,
                modelId: '',
              }))
            }
          >
            <option value="">{t('llmUsageAll')}</option>
            {catalog?.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
          <Select
            label={t('llmUsageFilterModel')}
            className={FIELD}
            value={filterDraft.modelId}
            onChange={(event) =>
              setFilterDraft((value) => ({ ...value, modelId: event.target.value }))
            }
          >
            <option value="">{t('llmUsageAll')}</option>
            {filteredModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </Select>
          <label className="space-y-1 text-xs font-medium text-neutral-600">
            <span>{t('llmUsageFilterUser')}</span>
            <input
              className={FIELD}
              value={filterDraft.userId}
              onChange={(event) =>
                setFilterDraft((value) => ({ ...value, userId: event.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={filterDraft.includeNonProduct}
              onChange={(event) =>
                setFilterDraft((value) => ({ ...value, includeNonProduct: event.target.checked }))
              }
            />
            {t('llmUsageIncludeNonProduct')}
          </label>
          <Button type="submit" size="sm" className="self-end" loading={loading}>
            {t('llmUsageApplyFilters')}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-error" role="alert">
          {t('llmUsageError')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          icon={CircleDollarSign}
          label={t('llmUsageTotalCost')}
          value={formatVndCurrency(data.totalCostVnd)}
          detail={`$${data.totalCostUsd.toFixed(4)}`}
          change={percentChange(data.totalCostUsd, data.previousPeriod.totalCostUsd)}
          lowerIsBetter
          t={t}
        />
        <MetricCard
          icon={CheckCircle2}
          label={t('llmUsageSuccessfulOutcomes')}
          value={data.successfulOperations.toLocaleString()}
          detail={formatPercent(data.analysis.successRate)}
          change={data.analysis.successRate - previousSuccessRate}
          t={t}
        />
        <MetricCard
          icon={Gauge}
          label={t('llmUsageCostPerSuccess')}
          value={`$${data.analysis.averageCostUsdPerSuccessfulOperation.toFixed(4)}`}
          detail={t('llmUsageUnitEconomics')}
          change={percentChange(
            data.analysis.averageCostUsdPerSuccessfulOperation,
            previousUnitCost,
          )}
          lowerIsBetter
          t={t}
        />
        <MetricCard
          icon={Activity}
          label={t('llmUsageAverageLatency')}
          value={formatLatency(data.analysis.averageLatencyMsPerOperation)}
          detail={t('llmUsageRouteLatencyHelp')}
          change={percentChange(data.analysis.averageLatencyMsPerOperation, previousLatency)}
          lowerIsBetter
          t={t}
        />
        <MetricCard
          icon={RefreshCw}
          label={t('llmUsageFallbackRate')}
          value={formatPercent(data.analysis.fallbackRate)}
          detail={t('llmUsageAttemptsPerOperation', {
            value: data.analysis.attemptsPerOperation.toFixed(2),
          })}
          t={t}
        />
        <MetricCard
          icon={BrainCircuit}
          label={t('llmUsageTotalTokens')}
          value={data.totalTokens.toLocaleString()}
          detail={t('llmUsageTokenSplit', {
            input: data.inputTokens.toLocaleString(),
            output: data.outputTokens.toLocaleString(),
          })}
          change={percentChange(data.totalTokens, data.previousPeriod.totalTokens)}
          lowerIsBetter
          t={t}
        />
      </div>

      <div
        className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1"
        role="tablist"
        aria-label={t('llmUsageViews')}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            id={`llm-usage-tab-${id}`}
            type="button"
            size="sm"
            variant={tab === id ? 'primary' : 'ghost'}
            role="tab"
            aria-selected={tab === id}
            aria-controls="llm-usage-panel"
            tabIndex={tab === id ? 0 : -1}
            className="min-h-10 shrink-0"
            onClick={() => setTab(id)}
            onKeyDown={(event) => navigateTabs(event, id)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>

      <div
        id="llm-usage-panel"
        role="tabpanel"
        aria-labelledby={`llm-usage-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'overview' ? (
          <div className="space-y-4">
            <DecisionInsights data={data} actionLabel={actionLabel} t={t} />
            <Card className="p-0">
              <CardHeader className="gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">{t('llmUsageTrendTitle')}</CardTitle>
                <div className="flex max-w-full gap-1 overflow-x-auto">
                  {(['cost', 'traffic', 'reliability', 'latency'] as LlmTrendMode[]).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={trendMode === mode ? 'secondary' : 'ghost'}
                      onClick={() => setTrendMode(mode)}
                    >
                      {t(`llmUsageTrend_${mode}`)}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-5 sm:px-5">
                <LlmUsageTrendChart
                  data={data.daily}
                  mode={trendMode}
                  labels={{
                    chart: t('llmUsageTrendTitle'),
                    cost: t('llmUsageTotalCost'),
                    success: t('llmUsageSuccessfulOutcomes'),
                    failed: t('llmUsageFailedOutcomes'),
                    fallback: t('llmUsageFallbackRate'),
                    latency: t('llmUsageAverageLatency'),
                    empty: t('noChartData'),
                  }}
                />
              </CardContent>
            </Card>
            <EfficiencyTable
              title={t('llmUsageActionEfficiency')}
              breakdown={data.byAction}
              labelFor={labelFor('action')}
              t={t}
            />
          </div>
        ) : null}

        {tab === 'cost' ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="p-0">
                <CardHeader className="px-5 pt-5">
                  <CardTitle className="text-base">{t('llmUsageByAction')}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4 sm:px-5">
                  <LlmBreakdownBarChart
                    data={data.byAction.rows.map((row) => ({
                      name: actionLabel(row.key),
                      value: row.costUsd,
                    }))}
                    label={t('llmUsageByAction')}
                    emptyLabel={t('noChartData')}
                  />
                </CardContent>
              </Card>
              <Card className="p-0">
                <CardHeader className="px-5 pt-5">
                  <CardTitle className="text-base">{t('llmUsageByModel')}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4 sm:px-5">
                  <LlmBreakdownBarChart
                    data={data.byModel.rows.map((row) => ({
                      name: labelFor('model')(row.key),
                      value: row.costUsd,
                    }))}
                    label={t('llmUsageByModel')}
                    emptyLabel={t('noChartData')}
                  />
                </CardContent>
              </Card>
            </div>
            <EfficiencyTable
              title={t('llmUsageByModel')}
              breakdown={data.byModel}
              labelFor={labelFor('model')}
              t={t}
            />
            <EfficiencyTable
              title={t('llmUsageByProvider')}
              breakdown={data.byProvider}
              labelFor={labelFor('provider')}
              t={t}
            />
          </div>
        ) : null}

        {tab === 'reliability' ? (
          <div className="space-y-4">
            <ObservabilityCard data={data} t={t} />
            <div className="grid gap-4 xl:grid-cols-2">
              <CompactBreakdownTable
                title={t('llmUsageByOutcome')}
                breakdown={data.byOutcome}
                labelFor={labelFor('outcome')}
                t={t}
              />
              <CompactBreakdownTable
                title={t('llmUsageByErrorCode')}
                breakdown={data.byErrorCode}
                labelFor={labelFor('raw')}
                t={t}
              />
            </div>
            <EfficiencyTable
              title={t('llmUsageReliabilityByAction')}
              breakdown={data.byAction}
              labelFor={labelFor('action')}
              t={t}
            />
          </div>
        ) : null}

        {tab === 'users' ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-line bg-neutral-50 p-3 text-sm text-neutral-600">
              {t('llmUsagePrivacyNote')}
            </p>
            <CompactBreakdownTable
              title={t('llmUsageByUser')}
              breakdown={data.byUser}
              labelFor={labelFor('raw')}
              t={t}
            />
            <UserActionTable data={data.byUserAction} actionLabel={actionLabel} t={t} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
