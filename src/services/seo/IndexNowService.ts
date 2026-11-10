import type { IIndexNowQueueRepository } from '@/interfaces/repositories/IIndexNowQueueRepository';
import {
  INDEXNOW_MAX_URLS_PER_CALL,
  normalizeIndexNowUrls,
  type IndexNowResult,
} from '@/lib/seo/indexnow';

/** At most one IndexNow call a minute (RIN-1496 AC 3). */
const INDEXNOW_MIN_INTERVAL_MS = 60_000;

export interface IndexNowServiceDeps {
  queue: IIndexNowQueueRepository;
  submit: (urls: readonly string[]) => Promise<IndexNowResult>;
  /** False outside production: nothing is queued and nothing is sent. */
  enabled: boolean;
  now?: () => Date;
}

/**
 * Queues changed public URLs and sends them in batches (RIN-1500). The queue
 * is in Mongo because a serverless function keeps no timer: every enqueue
 * tries a flush, and the flush that wins the throttle slot sends everything
 * pending. URLs that arrive inside the 60 s window go out with the next flush
 * or the post-deploy ping (RIN-1501); the TTL drops any that never do.
 */
export class IndexNowService {
  private readonly now: () => Date;

  constructor(private readonly deps: IndexNowServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async enqueue(urls: readonly string[]): Promise<void> {
    if (!this.deps.enabled) return;
    const kept = normalizeIndexNowUrls(urls);
    if (kept.length === 0) return;
    await this.deps.queue.enqueue(kept, this.now());
    await this.flush();
  }

  /** Sends the pending batch when the slot is free; returns the result, or null when nothing was sent. */
  async flush(): Promise<IndexNowResult | null> {
    if (!this.deps.enabled) return null;
    const pending = await this.deps.queue.listPending(INDEXNOW_MAX_URLS_PER_CALL);
    if (pending.length === 0) return null;
    const claimed = await this.deps.queue.claimSendSlot(this.now(), INDEXNOW_MIN_INTERVAL_MS);
    if (!claimed) return null;

    const result = await this.deps.submit(pending);
    // A 4xx other than 429 would fail again the same way: drop the batch.
    // Network errors, 429 and 5xx keep it for the next flush.
    if (result.outcome === 'sent' || result.outcome === 'rejected') {
      await this.deps.queue.removePending(pending);
    }
    return result;
  }
}
