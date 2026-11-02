import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const bucketCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  };
  const requestCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  };
  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
    endSession: vi.fn(),
  };
  return {
    bucketCollection,
    requestCollection,
    session,
    connectDB: vi.fn().mockResolvedValue(undefined),
    resolveEntitlements: vi.fn(),
    json: vi.fn((body: unknown, init?: ResponseInit) => Response.json(body, init)),
  };
});

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/lib/entitlements', () => ({
  resolveEntitlements: mocks.resolveEntitlements,
  getMeteredWindows: (entitlements: { tier: 'free' | 'premium' }, action: string) => {
    const limits = {
      free: { minute: 5, day: 25 },
      premium: { minute: 15, day: 150 },
    }[entitlements.tier];
    if (action !== 'ask_rin_chan') throw new Error(`Unexpected capability: ${action}`);
    return [
      { window: 'minute', limit: limits.minute },
      { window: 'day', limit: limits.day },
    ];
  },
}));
vi.mock('next/server', () => ({ NextResponse: { json: mocks.json } }));
vi.mock('mongoose', () => ({
  default: {
    connection: {
      db: {
        collection: (name: string) =>
          name === 'entitlement_usage_buckets' ? mocks.bucketCollection : mocks.requestCollection,
      },
      getClient: () => ({ startSession: () => mocks.session }),
    },
  },
}));

import {
  buildLlmRateLimitHeaders,
  buildLlmRateLimitResponse,
  commitLlmUsage,
  getLlmUsageSnapshot,
  refundLlmUsage,
  reserveLlmUsage,
} from './rate-limit';
import { isPremiumLimitError } from '@/features/subscription/lib/limit-error';

describe('entitlement usage ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEntitlements.mockResolvedValue({ tier: 'free' });
    mocks.requestCollection.findOne.mockResolvedValue(null);
    mocks.requestCollection.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.bucketCollection.findOne.mockResolvedValue(null);
    mocks.bucketCollection.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
  });

  it('atomically reserves every configured window', async () => {
    const result = await reserveLlmUsage('user-1', 'ask_rin_chan', 'request-1');

    expect(result).toMatchObject({
      allowed: true,
      disposition: 'reserved',
      userId: 'user-1',
      action: 'ask_rin_chan',
      requestId: 'request-1',
      duplicate: false,
      windows: [
        { window: 'minute', limit: 5, count: 1, remaining: 4 },
        { window: 'day', limit: 25, count: 1, remaining: 24 },
      ],
    });
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.bucketCollection.updateOne).toHaveBeenCalledTimes(2);
    expect(mocks.requestCollection.updateOne).toHaveBeenCalledWith(
      { userId: 'user-1', capability: 'ask_rin_chan', requestId: 'request-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'reserved' }),
        $setOnInsert: expect.objectContaining({ retentionExpiresAt: expect.any(Date) }),
      }),
      expect.objectContaining({ upsert: true, session: mocks.session }),
    );
  });

  it('rejects without incrementing when any configured window is exhausted', async () => {
    mocks.bucketCollection.findOne.mockImplementation(async (filter: { window: string }) =>
      filter.window === 'minute' ? { count: 5 } : { count: 3 },
    );

    const result = await reserveLlmUsage('user-2', 'ask_rin_chan', 'request-2');

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(mocks.bucketCollection.updateOne).not.toHaveBeenCalled();
    expect(mocks.requestCollection.updateOne).toHaveBeenCalledWith(
      { userId: 'user-2', capability: 'ask_rin_chan', requestId: 'request-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'denied', tier: 'free' }),
      }),
      expect.objectContaining({ upsert: true, session: mocks.session }),
    );
    const response = buildLlmRateLimitResponse(result);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'quota_exceeded',
        meta: { capability: 'ask_rin_chan', tier: 'free', upgradeEligible: true },
      },
    });
    expect(isPremiumLimitError(body.error)).toBe(true);

    const premiumBody = await buildLlmRateLimitResponse({ ...result, tier: 'premium' }).json();
    expect(premiumBody).toMatchObject({
      error: { code: 'quota_exceeded', meta: { tier: 'premium', upgradeEligible: false } },
    });
    expect(isPremiumLimitError(premiumBody.error)).toBe(false);
  });

  it('recognizes a committed idempotency key without charging again', async () => {
    const committed = {
      userId: 'user-3',
      capability: 'ask_rin_chan',
      requestId: 'request-3',
      status: 'committed',
      buckets: [],
      leaseExpiresAt: new Date(Date.now() + 60_000),
    };
    mocks.requestCollection.findOne.mockResolvedValue(committed);

    const result = await reserveLlmUsage('user-3', 'ask_rin_chan', 'request-3');

    expect(result).toMatchObject({
      allowed: true,
      disposition: 'committed',
      duplicate: true,
      userId: 'user-3',
    });
    expect(mocks.session.withTransaction).not.toHaveBeenCalled();
    expect(mocks.bucketCollection.updateOne).not.toHaveBeenCalled();
  });

  it('scopes commit and refund by user as well as request and capability', async () => {
    const reservation = await reserveLlmUsage('user-4', 'ask_rin_chan', 'request-4');
    await commitLlmUsage(reservation);

    expect(mocks.requestCollection.updateOne).toHaveBeenLastCalledWith(
      {
        userId: 'user-4',
        requestId: 'request-4',
        capability: 'ask_rin_chan',
        status: 'reserved',
      },
      expect.anything(),
    );

    mocks.requestCollection.findOne.mockResolvedValue({
      _id: 'usage-request-4',
      userId: 'user-4',
      capability: 'ask_rin_chan',
      requestId: 'request-4',
      status: 'reserved',
      buckets: [{ window: 'minute', bucketStart: new Date() }],
    });
    await refundLlmUsage(reservation);
    expect(mocks.requestCollection.findOne).toHaveBeenLastCalledWith(
      {
        userId: 'user-4',
        requestId: 'request-4',
        capability: 'ask_rin_chan',
      },
      { session: mocks.session },
    );
  });

  it.each([
    ['reserved', false, 'reserved'],
    ['denied', false, 'denied'],
  ] as const)(
    'returns duplicate %s reservations without charging again',
    async (status, allowed, disposition) => {
      mocks.requestCollection.findOne.mockResolvedValue({
        userId: 'user-duplicate',
        capability: 'ask_rin_chan',
        requestId: `request-${status}`,
        status,
        buckets: [],
        leaseExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        reserveLlmUsage('user-duplicate', 'ask_rin_chan', `request-${status}`),
      ).resolves.toMatchObject({ allowed, disposition, duplicate: true });
      expect(mocks.session.withTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['committed', true, 'committed'],
    ['denied', false, 'denied'],
    ['reserved', false, 'reserved'],
  ] as const)(
    'handles a concurrent %s request inside the transaction',
    async (status, allowed, disposition) => {
      mocks.requestCollection.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        userId: 'user-race',
        capability: 'ask_rin_chan',
        requestId: `race-${status}`,
        status,
        buckets: [],
        leaseExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        reserveLlmUsage('user-race', 'ask_rin_chan', `race-${status}`),
      ).resolves.toMatchObject({ allowed, disposition, duplicate: true });
      expect(mocks.bucketCollection.updateOne).not.toHaveBeenCalled();
    },
  );

  it('retries the reservation once when two callers race the same request id', async () => {
    // The unique index on (userId, capability, requestId) is what makes the
    // reservation idempotent under concurrency: the loser gets E11000 and asks
    // again, and the second read finds the winner's row.
    const winner = {
      userId: 'user-e11000',
      capability: 'ask_rin_chan',
      requestId: 'request-e11000',
      status: 'committed',
      buckets: [],
      leaseExpiresAt: new Date(Date.now() + 60_000),
    };
    // Nothing on the way in; the winner's row on every read the retry makes.
    mocks.requestCollection.findOne.mockResolvedValueOnce(null).mockResolvedValue(winner);
    mocks.session.withTransaction.mockRejectedValueOnce(
      Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }),
    );

    await expect(
      reserveLlmUsage('user-e11000', 'ask_rin_chan', 'request-e11000'),
    ).resolves.toMatchObject({ allowed: true, disposition: 'committed', duplicate: true });
    // The retry short-circuits on the duplicate read, so it never opens a second
    // transaction -- one attempt, and the losing session still gets closed.
    expect(mocks.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('propagates a transaction failure that is not a duplicate key', async () => {
    mocks.requestCollection.findOne.mockResolvedValue(null);
    mocks.session.withTransaction.mockRejectedValueOnce(new Error('replica set stepped down'));

    await expect(reserveLlmUsage('user-fail', 'ask_rin_chan', 'request-fail')).rejects.toThrow(
      'replica set stepped down',
    );
    expect(mocks.session.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not commit or refund denied usage', async () => {
    const denied = {
      allowed: false,
      disposition: 'denied' as const,
      userId: 'user-denied',
      tier: 'free' as const,
      action: 'ask_rin_chan' as const,
      requestId: 'request-denied',
      duplicate: false,
      windows: [],
    };

    await commitLlmUsage(denied);
    await refundLlmUsage(denied);

    expect(mocks.requestCollection.updateOne).not.toHaveBeenCalled();
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });

  it('leaves a missing or non-reserved refund request unchanged', async () => {
    const reservation = await reserveLlmUsage('user-refund', 'ask_rin_chan', 'request-refund');
    mocks.requestCollection.findOne.mockResolvedValueOnce(null);
    await refundLlmUsage(reservation);
    mocks.requestCollection.findOne.mockResolvedValueOnce({ status: 'committed' });
    await refundLlmUsage(reservation);

    expect(mocks.bucketCollection.updateOne).toHaveBeenCalledTimes(2);
  });

  it('stores the accepted job on commit and clears it when a request id is reserved again', async () => {
    const reservation = await reserveLlmUsage('user-job', 'ask_rin_chan', 'request-job');
    expect(mocks.requestCollection.updateOne).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        $unset: { jobId: '', jobAttempt: '', jobOutcome: '', refundedAt: '' },
      }),
      expect.anything(),
    );

    await commitLlmUsage(reservation, { jobId: 'job-9', jobAttempt: 1 });

    expect(mocks.requestCollection.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: 'request-job', status: 'reserved' }),
      {
        $set: {
          status: 'committed',
          updatedAt: expect.any(Date),
          jobId: 'job-9',
          jobAttempt: 1,
        },
      },
    );
  });

  it('builds snapshot and standard rate-limit headers', async () => {
    mocks.bucketCollection.findOne.mockResolvedValue({ count: 2 });
    const snapshot = await getLlmUsageSnapshot('user-snapshot', 'ask_rin_chan', {
      tier: 'free',
    });
    const headers = buildLlmRateLimitHeaders({
      allowed: false,
      disposition: 'denied',
      userId: 'user-snapshot',
      tier: 'free',
      action: 'ask_rin_chan',
      requestId: 'snapshot',
      duplicate: false,
      windows: snapshot,
      retryAfterSeconds: 15,
    }) as Record<string, string>;

    expect(headers).toMatchObject({
      'X-RateLimit-Tier': 'free',
      'X-RateLimit-Action': 'ask_rin_chan',
      'Retry-After': '15',
    });
    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(
      buildLlmRateLimitHeaders({
        allowed: true,
        disposition: 'reserved',
        userId: 'user-empty',
        tier: 'premium',
        action: 'ask_rin_chan',
        requestId: 'empty',
        duplicate: false,
        windows: [],
      }),
    ).toEqual({
      'X-RateLimit-Tier': 'premium',
      'X-RateLimit-Action': 'ask_rin_chan',
    });
  });
});
