import { describe, expect, it, vi } from 'vitest';

import type {
  IIndexNowQueueRepository,
  IndexNowSendRecord,
} from '@/interfaces/repositories/IIndexNowQueueRepository';
import type { IndexNowResult } from '@/lib/seo/indexnow';
import { IndexNowService } from '@/services/seo/IndexNowService';

const QUIZ_URL = 'https://www.rinkuzu.app/vi/quiz/fake-biology-quiz';
const HUB_URL = 'https://www.rinkuzu.app/vi/explore/fake-topic';
const START = new Date('2026-11-10T12:00:00.000Z');

/** In-memory queue with the same throttle rule as the Mongo repository. */
class FakeQueue implements IIndexNowQueueRepository {
  pending = new Map<string, Date>();
  lastSentAt: Date | null = null;
  lastResult: IndexNowSendRecord | null = null;

  async enqueue(urls: readonly string[], queuedAt: Date): Promise<void> {
    for (const url of urls) if (!this.pending.has(url)) this.pending.set(url, queuedAt);
  }

  async listPending(limit: number): Promise<string[]> {
    return [...this.pending.keys()].slice(0, limit);
  }

  async claimSendSlot(now: Date, minIntervalMs: number): Promise<boolean> {
    if (this.lastSentAt && now.getTime() - this.lastSentAt.getTime() < minIntervalMs) return false;
    this.lastSentAt = now;
    return true;
  }

  async removePending(urls: readonly string[]): Promise<void> {
    for (const url of urls) this.pending.delete(url);
  }

  async recordResult(record: IndexNowSendRecord): Promise<void> {
    this.lastResult = record;
  }
}

function sent(urls: readonly string[]): IndexNowResult {
  return { outcome: 'sent', status: 200, attempt: 1, urlCount: urls.length };
}

function setup(options: { enabled?: boolean; result?: IndexNowResult['outcome'] } = {}) {
  const queue = new FakeQueue();
  let now = START;
  const submit = vi.fn(async (urls: readonly string[]): Promise<IndexNowResult> => {
    const outcome = options.result ?? 'sent';
    return outcome === 'sent' ? sent(urls) : { ...sent(urls), outcome, status: 503 };
  });
  const service = new IndexNowService({
    queue,
    submit,
    enabled: options.enabled ?? true,
    now: () => now,
  });
  return {
    queue,
    submit,
    service,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('IndexNowService', () => {
  it('queues and sends nothing outside production', async () => {
    const { service, queue, submit } = setup({ enabled: false });
    await service.enqueue([QUIZ_URL]);
    expect(queue.pending.size).toBe(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it('dedupes, drops query strings and sends the batch', async () => {
    const { service, queue, submit } = setup();
    await service.enqueue([QUIZ_URL, QUIZ_URL, `${QUIZ_URL}?entry=hub`, HUB_URL]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith([QUIZ_URL, HUB_URL]);
    expect(queue.pending.size).toBe(0);
  });

  it('sends at most once within 60 s and keeps the rest for the next flush', async () => {
    const { service, queue, submit, advance } = setup();
    await service.enqueue([QUIZ_URL]);
    advance(10_000);
    await service.enqueue([HUB_URL]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect([...queue.pending.keys()]).toEqual([HUB_URL]);

    advance(51_000);
    await service.flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith([HUB_URL]);
    expect(queue.pending.size).toBe(0);
  });

  it('records the counts and status of each send, never the URLs (RIN-1511)', async () => {
    const { service, queue } = setup();
    await service.enqueue([QUIZ_URL, HUB_URL]);
    expect(queue.lastResult).toEqual({
      outcome: 'sent',
      status: 200,
      attempt: 1,
      urlCount: 2,
      at: START,
    });
  });

  it('records a failed send too, so a 4xx or 5xx is visible after the logs expire', async () => {
    const { service, queue } = setup({ result: 'failed' });
    await service.enqueue([QUIZ_URL]);
    expect(queue.lastResult).toMatchObject({ outcome: 'failed', status: 503, urlCount: 1 });
  });

  it('does not take the slot when nothing is pending', async () => {
    const { service, queue, submit } = setup();
    expect(await service.flush()).toBeNull();
    expect(queue.lastSentAt).toBeNull();
    expect(queue.lastResult).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps a failed batch for the next flush', async () => {
    const { service, queue } = setup({ result: 'failed' });
    await service.enqueue([QUIZ_URL]);
    expect([...queue.pending.keys()]).toEqual([QUIZ_URL]);
  });

  it('drops a rejected batch, which a resend would not fix', async () => {
    const { service, queue } = setup({ result: 'rejected' });
    await service.enqueue([QUIZ_URL]);
    expect(queue.pending.size).toBe(0);
  });
});
