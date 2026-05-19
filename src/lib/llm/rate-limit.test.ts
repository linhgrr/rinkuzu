import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStandardErrorBody } from '@/lib/api/error';

const connectDBMock = vi.fn().mockResolvedValue({});
const isUserPremiumMock = vi.fn();
const createSubscriptionServiceMock = vi.fn(() => ({
  isUserPremium: isUserPremiumMock,
}));
const nextJsonMock = vi.fn((body, init) => ({
  body,
  init,
  headers: new Headers(init?.headers),
}));
const rateLimiterCtorMock = vi.fn();

vi.mock('@/lib/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: createSubscriptionServiceMock,
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: nextJsonMock,
  },
}));

vi.mock('mongoose', () => ({
  default: {
    connection: {
      db: { collection: vi.fn() },
    },
  },
}));

vi.mock('rate-limiter-flexible', () => ({
  RateLimiterMongo: class {
    constructor() {
      return rateLimiterCtorMock();
    }
  },
}));

describe('LLM rate limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('allows requests when both windows remain under limit', async () => {
    const minuteConsume = vi.fn().mockResolvedValue({
      consumedPoints: 1,
      remainingPoints: 4,
      msBeforeNext: 60_000,
    });
    const dayConsume = vi.fn().mockResolvedValue({
      consumedPoints: 1,
      remainingPoints: 19,
      msBeforeNext: 86_400_000,
    });

    rateLimiterCtorMock
      .mockImplementationOnce(() => ({ consume: minuteConsume }))
      .mockImplementationOnce(() => ({ consume: dayConsume }));
    isUserPremiumMock.mockResolvedValue(false);

    const { checkLlmRateLimit } = await import('./rate-limit');
    const result = await checkLlmRateLimit('user-1', 'quiz_ask_ai');

    expect(connectDBMock).toHaveBeenCalledOnce();
    expect(createSubscriptionServiceMock).toHaveBeenCalledOnce();
    expect(isUserPremiumMock).toHaveBeenCalledWith('user-1');
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('free');
    expect(result.minute.limit).toBe(5);
    expect(result.minute.remaining).toBe(4);
    expect(result.day.limit).toBe(20);
    expect(result.day.remaining).toBe(19);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it('returns a 429-compatible result when a limiter rejects with consumed points', async () => {
    const minuteConsume = vi.fn().mockRejectedValue({
      consumedPoints: 6,
      remainingPoints: 0,
      msBeforeNext: 25_000,
    });
    const dayConsume = vi.fn().mockResolvedValue({
      consumedPoints: 2,
      remainingPoints: 18,
      msBeforeNext: 86_400_000,
    });

    rateLimiterCtorMock
      .mockImplementationOnce(() => ({ consume: minuteConsume }))
      .mockImplementationOnce(() => ({ consume: dayConsume }));
    isUserPremiumMock.mockResolvedValue(false);

    const { buildLlmRateLimitResponse, checkLlmRateLimit } = await import('./rate-limit');
    const result = await checkLlmRateLimit('user-2', 'quiz_ask_ai');
    buildLlmRateLimitResponse(result);

    expect(result.allowed).toBe(false);
    expect(result.minute.count).toBe(6);
    expect(result.minute.limit).toBe(5);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(nextJsonMock).toHaveBeenCalledOnce();
    const [body, init] = nextJsonMock.mock.calls[0] ?? [];
    expect(init.status).toBe(429);
    expect(body).toEqual(
      buildStandardErrorBody({
        code: 'llm_rate_limit_exceeded',
        message: 'Rate limit exceeded',
        detail: 'LLM rate limit exceeded',
        meta: {
          action: result.action,
          tier: result.tier,
          retryAfterSeconds: result.retryAfterSeconds,
          limits: {
            minute: {
              limit: result.minute.limit,
              remaining: result.minute.remaining,
              resetAt: result.minute.resetAt.toISOString(),
            },
            day: {
              limit: result.day.limit,
              remaining: result.day.remaining,
              resetAt: result.day.resetAt.toISOString(),
            },
          },
        },
      }),
    );
  });
});
