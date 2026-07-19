import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectDBMock, consumeMock, limiterOptions } = vi.hoisted(() => ({
  connectDBMock: vi.fn(),
  consumeMock: vi.fn(),
  limiterOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/mongoose', () => ({ default: connectDBMock }));
vi.mock('mongoose', () => ({ default: { connection: { db: { collection: vi.fn() } } } }));
vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rate-limiter-flexible')>();
  return {
    ...actual,
    RateLimiterMongo: class {
      constructor(options: Record<string, unknown>) {
        limiterOptions.push(options);
      }

      consume = consumeMock;
    },
  };
});

import { RateLimiterRes } from 'rate-limiter-flexible';

import { checkAuthRateLimit } from '@/lib/auth-rate-limit';

describe('checkAuthRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterOptions.length = 0;
    connectDBMock.mockResolvedValue(undefined);
  });

  it('returns the remaining quota after a successful consume', async () => {
    consumeMock.mockResolvedValueOnce({ remainingPoints: 7, msBeforeNext: 59_100 });

    await expect(checkAuthRateLimit('register_ip', '203.0.113.7')).resolves.toEqual({
      allowed: true,
      remaining: 7,
      resetSeconds: 60,
      limit: 5,
    });
  });

  it('maps only a limiter rejection to a blocked decision', async () => {
    consumeMock.mockRejectedValueOnce(new RateLimiterRes(0, 90_001, 6, false));

    await expect(checkAuthRateLimit('register_ip', '203.0.113.8')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 91,
      limit: 5,
    });
  });

  it('does not disguise Mongo infrastructure failures as rate limiting', async () => {
    const outage = new Error('MongoDB connection timed out');
    consumeMock.mockRejectedValueOnce(outage);

    await expect(checkAuthRateLimit('register_ip', '203.0.113.9')).rejects.toBe(outage);
  });
});
