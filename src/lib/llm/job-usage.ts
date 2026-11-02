import 'server-only';

import mongoose from 'mongoose';
import connectDB from '@/lib/mongoose';
import {
  decrementRequestBuckets,
  usageLedgerCollections,
  type LlmJobUsage,
  type LlmJobUsageOutcome,
  type LlmRateLimitAction,
} from './rate-limit';

// Settlement of usage committed for async jobs (adaptive pipeline, quiz drafts).
// The reserve/commit half lives in ./rate-limit; see
// src/lib/adaptive/pipeline-usage and src/lib/quiz/draft-usage.

/** Committed job-linked usage whose job outcome has not been observed yet. */
export async function listUnsettledLlmJobUsage(
  userId: string,
  action: LlmRateLimitAction,
  options: { since?: Date; limit?: number } = {},
): Promise<LlmJobUsage[]> {
  await connectDB();
  const { requests } = usageLedgerCollections();
  const rows = await requests
    .find(
      {
        userId,
        capability: action,
        status: 'committed',
        jobId: { $exists: true },
        jobOutcome: { $exists: false },
        ...(options.since && { createdAt: { $gte: options.since } }),
      },
      { projection: { _id: 0, requestId: 1, jobId: 1, jobAttempt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 20)
    .toArray();
  return rows.flatMap((row) =>
    row.jobId
      ? [{ requestId: row.requestId, jobId: row.jobId, jobAttempt: row.jobAttempt ?? 0 }]
      : [],
  );
}

/**
 * Hands back a committed unit whose async job produced nothing billable. The
 * conditional flip away from `committed` is the idempotency guard: repeated or
 * concurrent calls decrement the buckets at most once. Returns whether this
 * call refunded.
 */
export async function refundLlmJobUsage(
  userId: string,
  action: LlmRateLimitAction,
  requestId: string,
  outcome: Extract<LlmJobUsageOutcome, 'failed' | 'superseded'>,
): Promise<boolean> {
  await connectDB();
  const { buckets, requests } = usageLedgerCollections();
  const client = mongoose.connection.getClient();
  const session = client.startSession();
  try {
    const refunded = await session.withTransaction(async () => {
      const now = new Date();
      const request = await requests.findOneAndUpdate(
        {
          userId,
          capability: action,
          requestId,
          status: 'committed',
          jobId: { $exists: true },
          jobOutcome: { $exists: false },
        },
        { $set: { status: 'refunded', jobOutcome: outcome, refundedAt: now, updatedAt: now } },
        { session, returnDocument: 'before' },
      );
      if (!request) return false;
      await decrementRequestBuckets(buckets, request, session);
      return true;
    });
    return refunded === true;
  } finally {
    await session.endSession();
  }
}

/** Records a terminal job outcome that keeps the charge, so it is not re-checked. */
export async function settleLlmJobUsageOutcome(
  userId: string,
  action: LlmRateLimitAction,
  requestId: string,
  outcome: Extract<LlmJobUsageOutcome, 'completed' | 'cancelled' | 'missing'>,
): Promise<void> {
  await connectDB();
  const { requests } = usageLedgerCollections();
  await requests.updateOne(
    { userId, capability: action, requestId, status: 'committed', jobOutcome: { $exists: false } },
    { $set: { jobOutcome: outcome, updatedAt: new Date() } },
  );
}
