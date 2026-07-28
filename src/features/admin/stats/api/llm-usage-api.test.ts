import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({ fetchApiData: fetchApiDataMock }));

import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';

const breakdown = {
  key: null,
  total_tokens: 120,
  input_tokens: 80,
  output_tokens: 40,
  cost_usd: 0.02,
  calls: 2,
};

describe('fetchLlmUsageViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchApiDataMock.mockResolvedValue({
      window_days: 7,
      totals: {
        total_tokens: 120,
        input_tokens: 80,
        output_tokens: 40,
        cost_usd: 0.02,
        calls: 2,
      },
      by_action: [{ ...breakdown, key: 'quiz_extraction' }],
      by_model: [{ ...breakdown, key: 'model-a' }],
      by_user: [breakdown],
      daily: [{ date: '2026-07-28', total_tokens: 120, cost_usd: 0.02, calls: 2 }],
      analysis: {
        active_users: 1,
        average_tokens_per_call: 60,
        average_cost_usd_per_call: 0.01,
        top_user_id: null,
        top_user_cost_usd: 0.02,
        top_action: 'quiz_extraction',
        top_action_cost_share: 1,
        top_model: 'model-a',
        top_model_cost_share: 1,
      },
    });
  });

  it('maps token split and daily usage without adding profile data', async () => {
    const controller = new AbortController();

    await expect(fetchLlmUsageViewModel('7d', controller.signal)).resolves.toMatchObject({
      windowDays: 7,
      totalTokens: 120,
      inputTokens: 80,
      outputTokens: 40,
      calls: 2,
      byUser: [{ key: '(unknown)', inputTokens: 80, outputTokens: 40 }],
      daily: [{ date: '2026-07-28', totalTokens: 120, costUsd: 0.02, calls: 2 }],
      analysis: { topUserId: '(unknown)' },
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/llm-usage?window=7d', {
      cache: 'no-store',
      signal: controller.signal,
    });
  });
});
