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

import { consumeBillingRateLimit } from '@/lib/billing-rate-limit';
import { BillingDomainError } from '@/services/billing/billing-domain';

describe('consumeBillingRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterOptions.length = 0;
    connectDBMock.mockResolvedValue(undefined);
  });

  it('resolves without throwing when the limiter allows the call', async () => {
    consumeMock.mockResolvedValueOnce({ remainingPoints: 29, msBeforeNext: 599_000 });

    await expect(consumeBillingRateLimit('quote_user', 'user-1')).resolves.toBeUndefined();
  });

  it('throws a BillingDomainError with the computed retryAfterSeconds when quota is exhausted', async () => {
    consumeMock.mockRejectedValueOnce(new RateLimiterRes(0, 12_500, 30, false));

    const error: unknown = await consumeBillingRateLimit('quote_user', 'user-1').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(BillingDomainError);
    expect(error).toMatchObject({
      name: 'BillingDomainError',
      code: 'rate_limit_exceeded',
      status: 429,
      message: 'Too many billing requests. Try again in 13s.',
    });
  });

  it('rethrows an operational error unchanged instead of converting it to a 429', async () => {
    const outage = new Error('mongo down');
    consumeMock.mockRejectedValueOnce(outage);

    await expect(consumeBillingRateLimit('quote_user', 'user-1')).rejects.toBe(outage);
  });
});
