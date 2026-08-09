import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({ fetchApiData: fetchApiDataMock }));

import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';

const row = {
  key: null,
  logical_operations: 2,
  physical_attempts: 3,
  successful_operations: 1,
  failed_operations: 1,
  fallback_operations: 1,
  recoverable_failures: 1,
  total_latency_ms: 900,
  total_tokens: 120,
  input_tokens: 80,
  output_tokens: 40,
  cost_usd: 0.02,
};

const breakdown = (rows: object[]) => ({ rows, truncated: false });

describe('fetchLlmUsageViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchApiDataMock.mockResolvedValue({
      window_days: 7,
      totals: {
        logical_operations: 2,
        physical_attempts: 3,
        successful_operations: 1,
        failed_operations: 1,
        fallback_operations: 1,
        recoverable_failures: 1,
        total_latency_ms: 900,
        total_tokens: 120,
        input_tokens: 80,
        output_tokens: 40,
        cost_usd: 0.02,
      },
      previous_totals: {
        logical_operations: 4,
        physical_attempts: 5,
        successful_operations: 4,
        failed_operations: 0,
        fallback_operations: 1,
        recoverable_failures: 1,
        total_latency_ms: 1200,
        total_tokens: 200,
        input_tokens: 140,
        output_tokens: 60,
        cost_usd: 0.01,
      },
      by_action: breakdown([{ ...row, key: 'quiz_extraction' }]),
      by_model: breakdown([{ ...row, key: 'model-a' }]),
      by_provider: breakdown([{ ...row, key: 'provider-a' }]),
      by_user: breakdown([row]),
      by_outcome: breakdown([{ ...row, key: 'success' }]),
      by_error_code: breakdown([{ ...row, key: 'timeout' }]),
      by_user_action: {
        rows: [
          {
            user_id: 'user-1',
            action: 'quiz_extraction',
            logical_operations: 2,
            physical_attempts: 3,
            successful_operations: 1,
            failed_operations: 1,
            fallback_operations: 1,
            recoverable_failures: 1,
            total_latency_ms: 900,
            total_tokens: 120,
            input_tokens: 80,
            output_tokens: 40,
            cost_usd: 0.02,
          },
        ],
        truncated: false,
      },
      daily: [
        {
          date: '2026-07-28',
          logical_operations: 2,
          physical_attempts: 3,
          successful_operations: 1,
          failed_operations: 1,
          fallback_operations: 1,
          recoverable_failures: 1,
          total_latency_ms: 900,
          total_tokens: 120,
          input_tokens: 80,
          output_tokens: 40,
          cost_usd: 0.02,
        },
      ],
      observability: {
        token_anomalies: 1,
        unknown_pricing: 2,
        usage_unavailable: 5,
        persistence_failures: 3,
        missing_attribution: 4,
      },
    });
  });

  it('maps canonical operation-aware usage without restoring legacy call semantics', async () => {
    const controller = new AbortController();

    await expect(fetchLlmUsageViewModel('7d', controller.signal)).resolves.toMatchObject({
      windowDays: 7,
      totalTokens: 120,
      inputTokens: 80,
      outputTokens: 40,
      logicalOperations: 2,
      physicalAttempts: 3,
      successfulOperations: 1,
      failedOperations: 1,
      fallbackOperations: 1,
      recoverableFailures: 1,
      totalLatencyMs: 900,
      previousPeriod: {
        totalCostUsd: 0.01,
        logicalOperations: 4,
        successfulOperations: 4,
        totalLatencyMs: 1200,
      },
      byUser: {
        truncated: false,
        rows: [
          {
            key: '(unknown)',
            logicalOperations: 2,
            physicalAttempts: 3,
            successfulOperations: 1,
            failedOperations: 1,
            totalLatencyMs: 900,
            inputTokens: 80,
            outputTokens: 40,
          },
        ],
      },
      byUserAction: {
        rows: [
          {
            userId: 'user-1',
            action: 'quiz_extraction',
            logicalOperations: 2,
            physicalAttempts: 3,
            successfulOperations: 1,
            fallbackOperations: 1,
            totalLatencyMs: 900,
            totalTokens: 120,
            costUsd: 0.02,
          },
        ],
      },
      daily: [
        {
          date: '2026-07-28',
          totalTokens: 120,
          costUsd: 0.02,
          logicalOperations: 2,
          physicalAttempts: 3,
          successfulOperations: 1,
          failedOperations: 1,
          totalLatencyMs: 900,
        },
      ],
      byOutcome: {
        rows: [{ key: 'success', physicalAttempts: 3 }],
      },
      byErrorCode: {
        rows: [{ key: 'timeout', recoverableFailures: 1 }],
      },
      observability: {
        tokenAnomalies: 1,
        unknownPricing: 2,
        usageUnavailable: 5,
        persistenceFailures: 3,
        missingAttribution: 4,
      },
      analysis: {
        averageTokensPerOperation: 60,
        averageCostUsdPerOperation: 0.01,
        averageCostUsdPerSuccessfulOperation: 0.02,
        averageLatencyMsPerOperation: 450,
        attemptsPerOperation: 1.5,
        successRate: 0.5,
        fallbackRate: 0.5,
        topUserId: '(unknown)',
      },
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/llm-usage?window=7d', {
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('encodes the allowlisted usage filters and includes non-product traffic only explicitly', async () => {
    await fetchLlmUsageViewModel('30d', undefined, {
      action: 'quiz/extraction',
      userId: 'user one',
      providerId: 'provider?a',
      modelId: 'model#1',
      includeNonProduct: true,
    });

    const [url] = fetchApiDataMock.mock.calls[0] ?? [];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toEqual({
      window: '30d',
      action: 'quiz/extraction',
      user_id: 'user one',
      provider_id: 'provider?a',
      model_config_id: 'model#1',
      include_non_product: 'true',
    });
  });
});
