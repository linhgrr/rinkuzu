import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

import { integrationDatabaseUri } from '../../setup/integration-db';

// The suite owns the connection; the ledger's own connect helper is a no-op.
vi.mock('@/lib/mongoose', () => ({ default: async () => mongoose }));
vi.mock('@/lib/entitlements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/entitlements')>()),
  resolveEntitlements: async () => ({ tier: 'free' as const }),
}));

import { commitLlmUsage, getLlmUsageSnapshot, reserveLlmUsage } from '@/lib/llm/rate-limit';
import {
  listUnsettledLlmJobUsage,
  refundLlmJobUsage,
  settleLlmJobUsageOutcome,
} from '@/lib/llm/job-usage';

/**
 * RIN-589: an adaptive upload is charged when the pipeline accepts it (202),
 * before the job runs. These tests pin the ledger half of the refund against a
 * real replica set: a failed job's unit comes back exactly once, and a
 * completed job keeps its charge.
 */
describe('adaptive_pipeline job-linked refunds', () => {
  const users: string[] = [];
  const free = { tier: 'free' as const };

  function nextUser(): string {
    const user = `rin589-${randomUUID()}`;
    users.push(user);
    return user;
  }

  // The free tier allows one adaptive_pipeline per minute; step the clock so
  // each upload lands in its own minute bucket of the same month.
  let minute = 0;
  function nextMinute(): void {
    minute += 1;
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 10, 3, minute)));
  }

  async function chargedUpload(userId: string, jobId: string, jobAttempt = 0) {
    nextMinute();
    const reservation = await reserveLlmUsage(userId, 'adaptive_pipeline', randomUUID());
    expect(reservation.allowed).toBe(true);
    await commitLlmUsage(reservation, { jobId, jobAttempt });
    return reservation;
  }

  async function monthUsed(userId: string): Promise<number> {
    const windows = await getLlmUsageSnapshot(userId, 'adaptive_pipeline', free);
    return windows.find((window) => window.window === 'month')?.count ?? -1;
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Usage ledger integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    vi.useRealTimers();
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection.db;
    await Promise.all([
      db?.collection('entitlement_usage_requests').deleteMany({ userId: { $in: users } }),
      db?.collection('entitlement_usage_buckets').deleteMany({ userId: { $in: users } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('gives a failed job its unit back once, however many times it is settled', async () => {
    const userId = nextUser();
    const reservation = await chargedUpload(userId, 'job-failed');
    expect(await monthUsed(userId)).toBe(1);

    const [usage] = await listUnsettledLlmJobUsage(userId, 'adaptive_pipeline');
    expect(usage).toEqual({
      requestId: reservation.requestId,
      jobId: 'job-failed',
      jobAttempt: 0,
    });

    const results = await Promise.all([
      refundLlmJobUsage(userId, 'adaptive_pipeline', reservation.requestId, 'failed'),
      refundLlmJobUsage(userId, 'adaptive_pipeline', reservation.requestId, 'failed'),
    ]);
    await expect(
      refundLlmJobUsage(userId, 'adaptive_pipeline', reservation.requestId, 'failed'),
    ).resolves.toBe(false);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await monthUsed(userId)).toBe(0);
    await expect(listUnsettledLlmJobUsage(userId, 'adaptive_pipeline')).resolves.toEqual([]);
    const record = await mongoose.connection.db
      ?.collection('entitlement_usage_requests')
      .findOne({ userId, requestId: reservation.requestId });
    expect(record).toMatchObject({
      status: 'refunded',
      jobOutcome: 'failed',
      refundedAt: expect.any(Date),
    });
  });

  it('keeps a completed job charged and never refunds it afterwards', async () => {
    const userId = nextUser();
    const failed = await chargedUpload(userId, 'job-a');
    const completed = await chargedUpload(userId, 'job-b');
    expect(await monthUsed(userId)).toBe(2);

    await settleLlmJobUsageOutcome(userId, 'adaptive_pipeline', completed.requestId, 'completed');
    await refundLlmJobUsage(userId, 'adaptive_pipeline', failed.requestId, 'failed');

    await expect(
      refundLlmJobUsage(userId, 'adaptive_pipeline', completed.requestId, 'failed'),
    ).resolves.toBe(false);
    expect(await monthUsed(userId)).toBe(1);
    await expect(listUnsettledLlmJobUsage(userId, 'adaptive_pipeline')).resolves.toEqual([]);
  });

  it('lets a learner at the monthly limit upload again after a failed job', async () => {
    const userId = nextUser();
    await chargedUpload(userId, 'job-1');
    const second = await chargedUpload(userId, 'job-2');

    nextMinute();
    const blocked = await reserveLlmUsage(userId, 'adaptive_pipeline', randomUUID());
    expect(blocked.allowed).toBe(false);

    await refundLlmJobUsage(userId, 'adaptive_pipeline', second.requestId, 'failed');

    nextMinute();
    const retry = await reserveLlmUsage(userId, 'adaptive_pipeline', randomUUID());
    expect(retry.allowed).toBe(true);
  });

  it('does not touch another learner or a non-job reservation', async () => {
    const owner = nextUser();
    const other = nextUser();
    const owned = await chargedUpload(owner, 'job-owned');

    await expect(
      refundLlmJobUsage(other, 'adaptive_pipeline', owned.requestId, 'failed'),
    ).resolves.toBe(false);

    nextMinute();
    const sync = await reserveLlmUsage(owner, 'adaptive_pipeline', randomUUID());
    await commitLlmUsage(sync);
    await expect(
      refundLlmJobUsage(owner, 'adaptive_pipeline', sync.requestId, 'failed'),
    ).resolves.toBe(false);
    expect(await monthUsed(owner)).toBe(2);
    await expect(listUnsettledLlmJobUsage(owner, 'adaptive_pipeline')).resolves.toEqual([
      { requestId: owned.requestId, jobId: 'job-owned', jobAttempt: 0 },
    ]);
  });
});
