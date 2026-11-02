import { beforeEach, describe, expect, it, vi } from 'vitest';

// Query-shape tests for the job-linked settlement helpers. The real Mongo
// behaviour (bucket decrement, refund-once under repeated polls) is covered by
// tests/integration/billing/LlmJobUsageRefund.integration.test.ts.
const mocks = vi.hoisted(() => {
  const cursor = {
    sort: vi.fn(),
    limit: vi.fn(),
    toArray: vi.fn(),
  };
  const requests = {
    find: vi.fn(() => cursor),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  };
  const buckets = { name: 'buckets' };
  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
    endSession: vi.fn(),
  };
  return {
    cursor,
    requests,
    buckets,
    session,
    connectDB: vi.fn().mockResolvedValue(undefined),
    decrementRequestBuckets: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('mongoose', () => ({
  default: { connection: { getClient: () => ({ startSession: () => mocks.session }) } },
}));
vi.mock('./rate-limit', () => ({
  decrementRequestBuckets: mocks.decrementRequestBuckets,
  usageLedgerCollections: () => ({ buckets: mocks.buckets, requests: mocks.requests }),
}));

import { listUnsettledLlmJobUsage, refundLlmJobUsage, settleLlmJobUsageOutcome } from './job-usage';

describe('job-linked usage settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cursor.sort.mockReturnValue(mocks.cursor);
    mocks.cursor.limit.mockReturnValue(mocks.cursor);
    mocks.cursor.toArray.mockResolvedValue([]);
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
  });

  describe('listUnsettledLlmJobUsage', () => {
    it('lists committed, unsettled job-linked rows newest first with a default limit', async () => {
      mocks.cursor.toArray.mockResolvedValue([
        { requestId: 'request-2', jobId: 'job-2', jobAttempt: 1 },
        { requestId: 'request-1', jobId: 'job-1' },
        { requestId: 'request-0' },
      ]);

      const rows = await listUnsettledLlmJobUsage('user-1', 'adaptive_pipeline');

      expect(mocks.connectDB).toHaveBeenCalled();
      expect(mocks.requests.find).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          capability: 'adaptive_pipeline',
          status: 'committed',
          jobId: { $exists: true },
          jobOutcome: { $exists: false },
        },
        { projection: { _id: 0, requestId: 1, jobId: 1, jobAttempt: 1 } },
      );
      expect(mocks.cursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mocks.cursor.limit).toHaveBeenCalledWith(20);
      // A missing attempt defaults to the first attempt; rows without a job id are dropped.
      expect(rows).toEqual([
        { requestId: 'request-2', jobId: 'job-2', jobAttempt: 1 },
        { requestId: 'request-1', jobId: 'job-1', jobAttempt: 0 },
      ]);
    });

    it('applies the since window and a custom limit', async () => {
      const since = new Date('2026-11-01T00:00:00Z');

      await listUnsettledLlmJobUsage('user-1', 'adaptive_pipeline', { since, limit: 5 });

      expect(mocks.requests.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: { $gte: since } }),
        expect.anything(),
      );
      expect(mocks.cursor.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('refundLlmJobUsage', () => {
    it('flips a committed job row to refunded and decrements its buckets once', async () => {
      const before = { requestId: 'request-1', status: 'committed', jobId: 'job-1' };
      mocks.requests.findOneAndUpdate.mockResolvedValue(before);

      const refunded = await refundLlmJobUsage(
        'user-1',
        'adaptive_pipeline',
        'request-1',
        'failed',
      );

      expect(refunded).toBe(true);
      expect(mocks.requests.findOneAndUpdate).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          capability: 'adaptive_pipeline',
          requestId: 'request-1',
          status: 'committed',
          jobId: { $exists: true },
          jobOutcome: { $exists: false },
        },
        {
          $set: expect.objectContaining({
            status: 'refunded',
            jobOutcome: 'failed',
            refundedAt: expect.any(Date),
          }),
        },
        { session: mocks.session, returnDocument: 'before' },
      );
      expect(mocks.decrementRequestBuckets).toHaveBeenCalledWith(
        mocks.buckets,
        before,
        mocks.session,
      );
      expect(mocks.session.endSession).toHaveBeenCalled();
    });

    it('does nothing when the row is already settled', async () => {
      mocks.requests.findOneAndUpdate.mockResolvedValue(null);

      const refunded = await refundLlmJobUsage(
        'user-1',
        'adaptive_pipeline',
        'request-1',
        'superseded',
      );

      expect(refunded).toBe(false);
      expect(mocks.decrementRequestBuckets).not.toHaveBeenCalled();
      expect(mocks.session.endSession).toHaveBeenCalled();
    });

    it('ends the session when the transaction throws', async () => {
      mocks.session.withTransaction.mockRejectedValue(new Error('transaction aborted'));

      await expect(
        refundLlmJobUsage('user-1', 'adaptive_pipeline', 'request-1', 'failed'),
      ).rejects.toThrow('transaction aborted');
      expect(mocks.session.endSession).toHaveBeenCalled();
    });
  });

  describe('settleLlmJobUsageOutcome', () => {
    it('records a kept outcome only on an unsettled committed row', async () => {
      await settleLlmJobUsageOutcome('user-1', 'adaptive_pipeline', 'request-1', 'completed');

      expect(mocks.requests.updateOne).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          capability: 'adaptive_pipeline',
          requestId: 'request-1',
          status: 'committed',
          jobOutcome: { $exists: false },
        },
        { $set: { jobOutcome: 'completed', updatedAt: expect.any(Date) } },
      );
    });
  });
});
