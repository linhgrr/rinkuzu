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

import { consumeAdminRateLimit } from '@/lib/admin-rate-limit';

describe('consumeAdminRateLimit', () => {
  beforeEach(() => {
    consumeMock.mockReset();
  });

  it('charges the admin key in the indexed auth collection under an admin prefix', async () => {
    consumeMock.mockResolvedValue({ remainingPoints: 29, msBeforeNext: 60_000 });

    await expect(consumeAdminRateLimit('learner_search_user', 'admin-1')).resolves.toEqual({
      allowed: true,
      remaining: 29,
      resetSeconds: 60,
      limit: 30,
    });
    expect(consumeMock).toHaveBeenCalledWith('admin-1');
    expect(limiterOptions.at(-1)).toMatchObject({
      tableName: 'auth_rate_limits',
      keyPrefix: 'admin:learner_search_user',
      points: 30,
      duration: 60,
    });
  });
});
