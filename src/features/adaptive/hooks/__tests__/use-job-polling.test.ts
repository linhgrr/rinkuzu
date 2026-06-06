/**
 * Tests for useJobPolling — exercises createJobPoller (the pure testable core)
 * directly so no jsdom / @testing-library/react dependency is needed.
 *
 * Three behaviours validated:
 *   1. Terminal status → stops polling and fires onTerminal
 *   2. In-flight guard → fetcher is not called a second time while a poll is pending
 *   3. Disabled / not started → fetcher is never called
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createJobPoller } from '@/features/adaptive/hooks/use-job-polling';
import type { PollSnapshot } from '@/features/adaptive/hooks/use-job-polling';
import { AdaptiveApiError } from '@/features/adaptive/lib/api-client';

// ---------------------------------------------------------------------------
// Minimal snapshot factory
// ---------------------------------------------------------------------------

function snap(status: string, progress = 0, retry_after_seconds = 1): PollSnapshot {
  return { status: status as PollSnapshot['status'], progress, retry_after_seconds };
}

// ---------------------------------------------------------------------------
// Timer helpers — synchronous fake-timer driver compatible with node env
// ---------------------------------------------------------------------------

/** A minimal manual-timer harness that avoids vi.useFakeTimers global side-effects. */
class FakeTimers {
  private queue: Array<{ id: number; at: number; fn: () => void }> = [];
  private counter = 0;
  now = 0;

  schedule(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = ++this.counter;
    this.queue.push({ id, at: this.now + ms, fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  unschedule(id: ReturnType<typeof setTimeout>): void {
    this.queue = this.queue.filter((t) => t.id !== (id as unknown as number));
  }

  /** Advance virtual time by `ms` and fire all timers that are due. */
  async advanceBy(ms: number): Promise<void> {
    const target = this.now + ms;
    while (true) {
      const next = this.queue.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.now = next.at;
      this.queue = this.queue.filter((t) => t.id !== next.id);
      next.fn();
      // Yield via setImmediate to fully drain all microtasks (including async-function
      // continuations triggered by the timer callback) before processing the next timer.
      await new Promise<void>((res) => setImmediate(res));
    }
    this.now = target;
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createJobPoller', () => {
  let timers: FakeTimers;

  beforeEach(() => {
    timers = new FakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Terminal status stops polling and fires onTerminal
  // -------------------------------------------------------------------------
  it('stops polling and fires onTerminal when the job reaches a terminal status', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(snap('extracting', 0.3, 1))
      .mockResolvedValueOnce(snap('completed', 1, 0));

    const onTerminal = vi.fn();

    const poller = createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: { onTerminal },
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Let the first fetch (extracting) resolve.
    await Promise.resolve();
    await Promise.resolve();

    // Advance past the retry_after_seconds=1 delay (with jitter max ~1.15 s → use 2 s).
    await timers.advanceBy(2_000);

    // Second fetch (completed) should have fired; onTerminal should be called.
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));

    // No further timer should be pending once terminal.
    expect(timers.pendingCount).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 2. In-flight guard prevents overlapping fetches
  // -------------------------------------------------------------------------
  it('does not double-fetch while a poll is in flight', async () => {
    let resolveFirst!: (v: PollSnapshot) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PollSnapshot>((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValue(snap('completed', 1, 0));

    const poller = createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: {},
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start(); // First tick starts; first fetch is in-flight (unresolved)

    // Advance time by a large amount — no timer fires because no schedule was
    // called yet (the first tick is still in-flight).
    await timers.advanceBy(5_000);

    // Fetcher should have been called exactly once.
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Resolve the in-flight fetch so the poller can clean up.
    resolveFirst(snap('completed', 1, 0));
    await Promise.resolve();
    await Promise.resolve();
  });

  // -------------------------------------------------------------------------
  // 3. Disabled (never started) → fetcher is never called
  // -------------------------------------------------------------------------
  it('never calls the fetcher when the poller is not started', async () => {
    const fetcher = vi.fn().mockResolvedValue(snap('extracting', 0.1, 1));

    // We create the poller but deliberately do NOT call .start().
    createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: {},
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    await timers.advanceBy(5_000);

    expect(fetcher).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. stop() aborts pending timer and sets stopped flag
  // -------------------------------------------------------------------------
  it('stop() cancels a scheduled poll and prevents further fetches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(snap('extracting', 0.3, 2)) // schedules next poll
      .mockResolvedValue(snap('extracting', 0.5, 2));

    const poller = createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: {},
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Let first fetch resolve (schedules next poll ~2 s away).
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Stop before the timer fires.
    poller.stop();
    expect(timers.pendingCount).toBe(0);

    // Advance well past where the next poll would have fired.
    await timers.advanceBy(10_000);

    // Still only one call.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 5. Retryable error → backs off and reschedules; onError fires
  // -------------------------------------------------------------------------
  it('backs off and reschedules on a retryable error', async () => {
    const retryableErr = new AdaptiveApiError({
      code: 'service_unavailable',
      message: 'unavailable',
      retryable: true,
    });

    // Use a latch so we can control exactly when the first fetch resolves.
    let rejectFirst!: (err: unknown) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PollSnapshot>((_, rej) => {
            rejectFirst = rej;
          }),
      )
      .mockResolvedValue(snap('completed', 1, 0));

    const calls: string[] = [];
    const onError = vi.fn((_err: unknown) => {
      calls.push('onError');
    });
    const onTerminal = vi.fn((_snap: PollSnapshot) => {
      calls.push('onTerminal');
    });

    const poller = createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: { onError, onTerminal },
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Reject the first fetch, drain all microtasks synchronously.
    rejectFirst(retryableErr);
    // setImmediate fires AFTER all pending microtasks including async-function continuations.
    await new Promise<void>((res) => setImmediate(res));

    // onError should have fired via the retryable path.
    expect(calls).toContain('onError');
    expect(timers.pendingCount).toBe(1);

    // The retryable path doubles the delay: BASE_DELAY_MS*2=4000ms, jitter ±15% → max ~4600ms.
    // Advance by 5000ms to reliably cover the worst-case jittered delay.
    await timers.advanceBy(5_000);
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // Second fetch succeeds → terminal.
    expect(calls).toContain('onTerminal');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 6. Non-retryable error → stops polling and fires onError
  // -------------------------------------------------------------------------
  it('stops polling and fires onError on a non-retryable error', async () => {
    const fatalErr = new AdaptiveApiError({
      code: 'not_found',
      message: 'job not found',
      retryable: false,
    });

    const fetcher = vi.fn().mockRejectedValue(fatalErr);
    const onError = vi.fn();

    const poller = createJobPoller({
      jobId: 'j1',
      fetcher,
      handlers: { onError },
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Let the fetch settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(fatalErr);

    // No retry timer should be scheduled.
    expect(timers.pendingCount).toBe(0);

    // Advancing time produces no further fetches.
    await timers.advanceBy(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
