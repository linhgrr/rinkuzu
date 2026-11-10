/**
 * Pending IndexNow URLs and the one throttle slot (RIN-1500). Serverless
 * functions keep no timers, so the batch lives in Mongo: changes queue here
 * and the next flush that wins the slot sends them all.
 */
/**
 * The outcome of the latest send: counts and status only, never URLs. Vercel
 * keeps runtime logs for about an hour, so this is the durable record that a
 * flush reached IndexNow (RIN-1511).
 */
export interface IndexNowSendRecord {
  outcome: 'sent' | 'rejected' | 'failed' | 'skipped';
  status: number | null;
  attempt: number;
  urlCount: number;
  at: Date;
}

export interface IIndexNowQueueRepository {
  /** Upserts each URL; a URL already pending keeps one entry. */
  enqueue(urls: readonly string[], queuedAt: Date): Promise<void>;

  /** Up to `limit` pending URLs, oldest first. */
  listPending(limit: number): Promise<string[]>;

  /**
   * Atomically takes the send slot when the last send was at least
   * `minIntervalMs` before `now`. Returns false when another flush holds it.
   */
  claimSendSlot(now: Date, minIntervalMs: number): Promise<boolean>;

  /** Removes the given URLs from the queue. */
  removePending(urls: readonly string[]): Promise<void>;

  /** Stores the latest send result on the throttle document, replacing the previous one. */
  recordResult(record: IndexNowSendRecord): Promise<void>;
}
