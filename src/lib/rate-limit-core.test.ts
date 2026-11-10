import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectDBMock, consumeMock, rewardMock, limiterOptions } = vi.hoisted(() => ({
  connectDBMock: vi.fn(),
  consumeMock: vi.fn(),
  rewardMock: vi.fn(),
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
      reward = rewardMock;
    },
  };
});

import { RateLimiterRes } from 'rate-limiter-flexible';

import { createRateLimiterRegistry } from '@/lib/rate-limit-core';

const registry = createRateLimiterRegistry(
  { collection: 'test_limits', keyPrefix: 'test:', envPrefix: 'TEST_RATE' },
  { ping: { points: 3, durationSec: 60 } },
);

describe('createRateLimiterRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterOptions.length = 0;
    connectDBMock.mockResolvedValue(undefined);
  });

  it('honors env overrides via <envPrefix>_<ACTION>_<POINTS|DURATION>', () => {
    process.env['TEST_RATE_PING_POINTS'] = '7';
    expect(registry.resolveLimit('ping').points).toBe(7);
    delete process.env['TEST_RATE_PING_POINTS'];
    expect(registry.resolveLimit('ping').points).toBe(3);
  });

  it('maps a successful consume to an allowed outcome', async () => {
    consumeMock.mockResolvedValueOnce({ remainingPoints: 2, msBeforeNext: 30_000 });
    await expect(registry.consume('ping', 'k')).resolves.toEqual({
      allowed: true,
      remaining: 2,
      resetSeconds: 30,
      limit: 3,
    });
  });

  it('maps quota exhaustion to a disallowed outcome and rethrows operational errors', async () => {
    consumeMock.mockRejectedValueOnce(new RateLimiterRes(0, 4_000, 0, false));
    await expect(registry.consume('ping', 'k')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 4,
      limit: 3,
    });

    consumeMock.mockRejectedValueOnce(new Error('mongo down'));
    await expect(registry.consume('ping', 'k')).rejects.toThrow('mongo down');
  });

  it('refund gives one point back to the key', async () => {
    rewardMock.mockResolvedValueOnce({});
    await registry.refund('ping', 'k');
    expect(rewardMock).toHaveBeenCalledWith('k', 1);
  });
});
