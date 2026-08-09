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
  recoverable_failures: 1,
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
        total_tokens: 120,
        input_tokens: 80,
        output_tokens: 40,
        cost_usd: 0.02,
      },
      by_action: breakdown([{ ...row, key: 'quiz_extraction' }]),
      by_model: breakdown([{ ...row, key: 'model-a' }]),
      by_provider: breakdown([{ ...row, key: 'provider-a' }]),
      by_user: breakdown([row]),
      by_user_action: { rows: [], truncated: false },
      daily: [
        {
          date: '2026-07-28',
          logical_operations: 2,
          physical_attempts: 3,
          recoverable_failures: 1,
          total_tokens: 120,
          input_tokens: 80,
          output_tokens: 40,
          cost_usd: 0.02,
        },
      ],
      observability: {
        token_anomalies: 1,
        unknown_pricing: 2,
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
      byUser: {
        truncated: false,
        rows: [
          {
            key: '(unknown)',
            logicalOperations: 2,
            physicalAttempts: 3,
            inputTokens: 80,
            outputTokens: 40,
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
        },
      ],
      observability: {
        tokenAnomalies: 1,
        unknownPricing: 2,
        persistenceFailures: 3,
        missingAttribution: 4,
      },
      analysis: {
        averageTokensPerOperation: 60,
        averageCostUsdPerOperation: 0.01,
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
});
