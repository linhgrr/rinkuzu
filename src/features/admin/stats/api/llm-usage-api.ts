import type { components } from '@/generated/adaptive-api';
import type {
  LlmUsageBreakdown,
  LlmUsageBreakdownRow,
  LlmUsageFilters,
  LlmUsageWindow,
  LlmUsageViewModel,
} from '@/features/admin/stats/types/llm-usage-view-model';
import { fetchApiData } from '@/lib/api/client';

type ApiSchemas = components['schemas'];
type LlmUsageSummaryDto = ApiSchemas['LlmUsageSummaryResponse'];
type UsageBreakdownDto = ApiSchemas['LlmUsageBreakdownResponse'];
type UsageDimensionDto = ApiSchemas['LlmUsageDimensionRow'];
type UsageUserActionDto = ApiSchemas['LlmUsageUserActionRow'];

// Display-only conversion. Provider billing remains denominated in USD in the
// backend usage event; this rate never participates in accounting.
const USD_TO_VND = Number(process.env['NEXT_PUBLIC_USD_TO_VND']) || 25_000;

function toRow(dto: UsageDimensionDto): LlmUsageBreakdownRow {
  return {
    key: dto.key ?? '(unknown)',
    logicalOperations: dto.logical_operations,
    physicalAttempts: dto.physical_attempts,
    successfulOperations: dto.successful_operations,
    failedOperations: dto.failed_operations,
    fallbackOperations: dto.fallback_operations,
    recoverableFailures: dto.recoverable_failures,
    totalLatencyMs: dto.total_latency_ms,
    totalTokens: dto.total_tokens,
    inputTokens: dto.input_tokens,
    outputTokens: dto.output_tokens,
    costUsd: dto.cost_usd,
  };
}

function toBreakdown(dto: UsageBreakdownDto): LlmUsageBreakdown {
  return {
    rows: dto.rows.map(toRow),
    truncated: dto.truncated,
  };
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function firstRow(breakdown: LlmUsageBreakdown): LlmUsageBreakdownRow | undefined {
  return breakdown.rows[0];
}

export async function fetchLlmUsageViewModel(
  window: LlmUsageWindow = '30d',
  signal?: AbortSignal,
  filters: LlmUsageFilters = {},
): Promise<LlmUsageViewModel> {
  const params = new URLSearchParams({ window });
  if (filters.action) params.set('action', filters.action);
  if (filters.userId) params.set('user_id', filters.userId);
  if (filters.providerId) params.set('provider_id', filters.providerId);
  if (filters.modelId) params.set('model_config_id', filters.modelId);
  if (filters.includeNonProduct) params.set('include_non_product', 'true');
  const dto = await fetchApiData<LlmUsageSummaryDto>(`/api/admin/llm-usage?${params}`, {
    cache: 'no-store',
    signal,
  });

  const byAction = toBreakdown(dto.by_action);
  const byModel = toBreakdown(dto.by_model);
  const byUser = toBreakdown(dto.by_user);
  const byProvider = toBreakdown(dto.by_provider);
  const byOutcome = toBreakdown(dto.by_outcome);
  const byErrorCode = toBreakdown(dto.by_error_code);
  const totalCostUsd = dto.totals.cost_usd;
  const logicalOperations = dto.totals.logical_operations;
  const topUser = firstRow(byUser);
  const topAction = firstRow(byAction);
  const topModel = firstRow(byModel);

  return {
    windowDays: dto.window_days,
    totalTokens: dto.totals.total_tokens,
    inputTokens: dto.totals.input_tokens,
    outputTokens: dto.totals.output_tokens,
    totalCostUsd,
    totalCostVnd: Math.round(totalCostUsd * USD_TO_VND),
    logicalOperations,
    physicalAttempts: dto.totals.physical_attempts,
    successfulOperations: dto.totals.successful_operations,
    failedOperations: dto.totals.failed_operations,
    fallbackOperations: dto.totals.fallback_operations,
    recoverableFailures: dto.totals.recoverable_failures,
    totalLatencyMs: dto.totals.total_latency_ms,
    previousPeriod: {
      totalTokens: dto.previous_totals.total_tokens,
      totalCostUsd: dto.previous_totals.cost_usd,
      logicalOperations: dto.previous_totals.logical_operations,
      physicalAttempts: dto.previous_totals.physical_attempts,
      successfulOperations: dto.previous_totals.successful_operations,
      failedOperations: dto.previous_totals.failed_operations,
      fallbackOperations: dto.previous_totals.fallback_operations,
      totalLatencyMs: dto.previous_totals.total_latency_ms,
    },
    byAction,
    byModel,
    byUser,
    byProvider,
    byOutcome,
    byErrorCode,
    byUserAction: {
      rows: dto.by_user_action.rows.map((row: UsageUserActionDto) => ({
        userId: row.user_id ?? 'legacy/unknown',
        action: row.action ?? 'legacy/unknown',
        logicalOperations: row.logical_operations,
        physicalAttempts: row.physical_attempts,
        successfulOperations: row.successful_operations,
        failedOperations: row.failed_operations,
        fallbackOperations: row.fallback_operations,
        recoverableFailures: row.recoverable_failures,
        totalLatencyMs: row.total_latency_ms,
        totalTokens: row.total_tokens,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        costUsd: row.cost_usd,
      })),
      truncated: dto.by_user_action.truncated,
    },
    daily: dto.daily.map((row) => ({
      date: row.date,
      logicalOperations: row.logical_operations,
      physicalAttempts: row.physical_attempts,
      successfulOperations: row.successful_operations,
      failedOperations: row.failed_operations,
      fallbackOperations: row.fallback_operations,
      recoverableFailures: row.recoverable_failures,
      totalLatencyMs: row.total_latency_ms,
      totalTokens: row.total_tokens,
      costUsd: row.cost_usd,
    })),
    observability: {
      tokenAnomalies: dto.observability.token_anomalies,
      unknownPricing: dto.observability.unknown_pricing,
      usageUnavailable: dto.observability.usage_unavailable,
      persistenceFailures: dto.observability.persistence_failures,
      missingAttribution: dto.observability.missing_attribution,
    },
    analysis: {
      averageTokensPerOperation: safeRatio(dto.totals.total_tokens, logicalOperations),
      averageCostUsdPerOperation: safeRatio(totalCostUsd, logicalOperations),
      averageCostUsdPerSuccessfulOperation: safeRatio(
        totalCostUsd,
        dto.totals.successful_operations,
      ),
      averageLatencyMsPerOperation: safeRatio(dto.totals.total_latency_ms, logicalOperations),
      attemptsPerOperation: safeRatio(dto.totals.physical_attempts, logicalOperations),
      successRate: safeRatio(dto.totals.successful_operations, logicalOperations),
      fallbackRate: safeRatio(dto.totals.fallback_operations, logicalOperations),
      topUserId: topUser?.key ?? '(unknown)',
      topUserCostUsd: topUser?.costUsd ?? 0,
      topAction: topAction?.key ?? '(unknown)',
      topActionCostShare: safeRatio(topAction?.costUsd ?? 0, totalCostUsd),
      topModel: topModel?.key ?? '(unknown)',
      topModelCostShare: safeRatio(topModel?.costUsd ?? 0, totalCostUsd),
    },
  };
}
