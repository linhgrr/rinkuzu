import type {
  IIndexNowQueueRepository,
  IndexNowSendRecord,
} from '@/interfaces/repositories/IIndexNowQueueRepository';
import connectDB from '@/lib/mongoose';
import { INDEXNOW_THROTTLE_ID, IndexNowPendingUrl, IndexNowThrottle } from '@/models/IndexNowQueue';

const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

export class IndexNowQueueRepository implements IIndexNowQueueRepository {
  async enqueue(urls: readonly string[], queuedAt: Date): Promise<void> {
    if (urls.length === 0) return;
    await connectDB();
    await IndexNowPendingUrl.bulkWrite(
      urls.map((url) => ({
        updateOne: {
          filter: { url },
          update: { $setOnInsert: { url, queuedAt } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async listPending(limit: number): Promise<string[]> {
    await connectDB();
    const rows = await IndexNowPendingUrl.find({}, { url: 1, _id: 0 })
      .sort({ queuedAt: 1 })
      .limit(limit)
      .lean<{ url: string }[]>();
    return rows.map((row) => row.url);
  }

  async claimSendSlot(now: Date, minIntervalMs: number): Promise<boolean> {
    await connectDB();
    const cutoff = new Date(now.getTime() - minIntervalMs);
    try {
      // The upsert inserts the slot the first time; when a recent send holds
      // it, the filter misses and the insert collides on _id.
      await IndexNowThrottle.updateOne(
        { _id: INDEXNOW_THROTTLE_ID, lastSentAt: { $lte: cutoff } },
        { $set: { lastSentAt: now } },
        { upsert: true },
      );
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  async removePending(urls: readonly string[]): Promise<void> {
    if (urls.length === 0) return;
    await connectDB();
    await IndexNowPendingUrl.deleteMany({ url: { $in: [...urls] } });
  }

  async recordResult(record: IndexNowSendRecord): Promise<void> {
    await connectDB();
    await IndexNowThrottle.updateOne(
      { _id: INDEXNOW_THROTTLE_ID },
      { $set: { lastResult: record } },
    );
  }
}
