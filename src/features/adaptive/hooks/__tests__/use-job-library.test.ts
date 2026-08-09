/**
 * Tests for useJobLibrary — exercises createLibraryPoller (the pure testable core)
 * directly so no jsdom / @testing-library/react dependency is needed.
 *
 * Four behaviours validated:
 *   1. Polls while any job is active, then STOPS after all become terminal.
 *   2. retry(jobId) calls retryJob then triggers a refresh tick; onBusy toggled.
 *   3. cancel(jobId) calls cancelJob then triggers a refresh tick.
 *   4. List error schedules a retry at MAX_DELAY_MS (doesn't throw out of tick).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLibraryPoller,
  type LibraryPollerOptions,
} from '@/features/adaptive/hooks/library-poller';
import type { PipelineJobListItem } from '@/features/adaptive/types/pipeline';

// ---------------------------------------------------------------------------
// Minimal job factory
// ---------------------------------------------------------------------------

function makeJob(
  jobId: string,
  status: PipelineJobListItem['status'],
  retry_after_seconds = 1,
): PipelineJobListItem {
  return {
    job_id: jobId,
    filename: `${jobId}.pdf`,
    subject_id: `s-${jobId}`,
    status,
    current_step: 'extracting',
    progress: 0,
    page_batch_size: 10,
    batch_count: 0,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: 0,
    concepts_after_merge: 0,
    relations_accepted: 0,
    relations_llm_verified: 0,
    relations_deterministic_unverified: 0,
    error_code: null,
    user_message: null,
    retryable: true,
    retry_count: 0,
    eta_seconds: null,
    is_terminal: status === 'completed' || status === 'failed' || status === 'cancelled',
    is_delayed: false,
    retry_after_seconds,
    created_at: Date.now(),
    updated_at: Date.now(),
    heartbeat_at: Date.now(),
    completed_at: null,
  };
}

// ---------------------------------------------------------------------------
// Timer helpers — synchronous fake-timer driver compatible with node env
// (mirrors the FakeTimers in use-job-polling.test.ts exactly)
// ---------------------------------------------------------------------------

class FakeTimers {
  private queue: Array<{
    id: ReturnType<typeof setTimeout>;
    at: number;
    fn: () => void;
  }> = [];
  now = 0;

  schedule(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => undefined, 0);
    clearTimeout(id);
    this.queue.push({ id, at: this.now + ms, fn });
    return id;
  }

  unschedule(id: ReturnType<typeof setTimeout>): void {
    this.queue = this.queue.filter((t) => t.id !== id);
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

function createTestLibraryPoller(options: Omit<LibraryPollerOptions, 'onTickSettled'>) {
  return createLibraryPoller({
    ...options,
    onTickSettled: vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createLibraryPoller', () => {
  let timers: FakeTimers;

  beforeEach(() => {
    timers = new FakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Polls while any job is active, stops once all are terminal
  // -------------------------------------------------------------------------
  it('polls while any job is active then stops once all are terminal', async () => {
    // First call returns an active job; second returns the same job as completed.
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 1)])
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]);

    const onJobs = vi.fn();

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs,
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Let the first tick (immediate async call) resolve.
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // First call completed → onJobs called once, next tick scheduled.
    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(onJobs).toHaveBeenCalledTimes(1);
    expect(timers.pendingCount).toBe(1);

    // Advance past retry_after_seconds=1 → 1000ms delay (clamped min).
    await timers.advanceBy(1_500);

    // Second call should have fired and returned completed → no more timers.
    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(onJobs).toHaveBeenCalledTimes(2);
    expect(timers.pendingCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. retry(jobId) calls retryJob then triggers a refresh tick; onBusy toggled
  // -------------------------------------------------------------------------
  it('retry(jobId) calls retryJob then refreshes; onBusy toggled jobId → null', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'failed', 1)]) // initial tick
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 1)]); // refresh after retry

    const retryJob = vi.fn().mockResolvedValue({ job_id: 'j1', status: 'queued' });
    const onBusy = vi.fn();
    const onJobs = vi.fn();

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob,
      cancelJob: vi.fn(),
      onJobs,
      onBusy,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Drain the initial tick.
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // All jobs are terminal (failed) after first list → poller stopped.
    // Now call retry — it should re-start and refresh.
    const retryPromise = poller.retry('j1');

    // onBusy should be called immediately with the jobId.
    await new Promise<void>((res) => setImmediate(res));
    expect(onBusy).toHaveBeenCalledWith('j1');

    await retryPromise;

    // retryJob called, then listJobs called again (refresh tick).
    expect(retryJob).toHaveBeenCalledWith('j1');
    expect(listJobs).toHaveBeenCalledTimes(2);

    // onBusy should have been called with null at the end.
    expect(onBusy).toHaveBeenCalledWith(null);

    // Order: busy('j1') then busy(null).
    const busyCalls = onBusy.mock.calls.map((c) => c[0]);
    expect(busyCalls[0]).toBe('j1');
    expect(busyCalls[busyCalls.length - 1]).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. cancel(jobId) calls cancelJob then triggers a refresh tick
  // -------------------------------------------------------------------------
  it('cancel(jobId) calls cancelJob then refreshes', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 1)]) // initial tick
      .mockResolvedValueOnce([makeJob('j1', 'cancelled', 0)]); // refresh after cancel

    const cancelJob = vi.fn().mockResolvedValue({ job_id: 'j1', status: 'cancelled' });
    const onBusy = vi.fn();

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob,
      onJobs: vi.fn(),
      onBusy,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Drain initial tick.
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    expect(listJobs).toHaveBeenCalledTimes(1);

    // Cancel the job.
    await poller.cancel('j1');

    expect(cancelJob).toHaveBeenCalledWith('j1');
    // refresh tick was triggered.
    expect(listJobs).toHaveBeenCalledTimes(2);

    // onBusy toggled: called with 'j1' then null.
    expect(onBusy).toHaveBeenCalledWith('j1');
    expect(onBusy).toHaveBeenCalledWith(null);
  });

  it('ignores an in-flight pre-cancel response and waits for a fresh list', async () => {
    let resolveStaleList!: (jobs: PipelineJobListItem[]) => void;
    const listJobs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((resolve) => {
            resolveStaleList = resolve;
          }),
      )
      .mockResolvedValueOnce([makeJob('j1', 'cancelled', 0)]);
    const onJobs = vi.fn();
    const onBusy = vi.fn();
    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn().mockResolvedValue({ job_id: 'j1', status: 'cancelled' }),
      onJobs,
      onBusy,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    expect(listJobs).toHaveBeenCalledTimes(1);

    const cancelPromise = poller.cancel('j1');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(onBusy).toHaveBeenCalledWith('j1');

    resolveStaleList([makeJob('j1', 'extracting', 1)]);
    await cancelPromise;

    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(onJobs).toHaveBeenCalledTimes(1);
    expect(onJobs).toHaveBeenCalledWith([expect.objectContaining({ status: 'cancelled' })]);
    expect(onBusy).toHaveBeenLastCalledWith(null);
    expect(timers.pendingCount).toBe(0);
  });

  it('does not restart a queued post-cancel refresh after stop', async () => {
    let resolveStaleList!: (jobs: PipelineJobListItem[]) => void;
    const listJobs = vi.fn().mockImplementationOnce(
      () =>
        new Promise<PipelineJobListItem[]>((resolve) => {
          resolveStaleList = resolve;
        }),
    );
    const onJobs = vi.fn();
    const onBusy = vi.fn();
    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn().mockResolvedValue({ job_id: 'j1', status: 'cancelled' }),
      onJobs,
      onBusy,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    const cancelPromise = poller.cancel('j1');
    await new Promise<void>((resolve) => setImmediate(resolve));
    poller.stop();

    resolveStaleList([makeJob('j1', 'extracting', 1)]);
    await cancelPromise;

    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(onJobs).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(null);
    expect(timers.pendingCount).toBe(0);
  });

  it('coalesces concurrent refreshes behind an in-flight list into the latest request', async () => {
    let resolveStaleList!: (jobs: PipelineJobListItem[]) => void;
    const listJobs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((resolve) => {
            resolveStaleList = resolve;
          }),
      )
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]);
    const onJobs = vi.fn();
    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs,
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    const supersededRefresh = poller.tickNow();
    const latestRefresh = poller.tickNow();
    resolveStaleList([makeJob('j1', 'extracting', 1)]);

    await Promise.all([supersededRefresh, latestRefresh]);

    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(onJobs).toHaveBeenCalledTimes(1);
    expect(onJobs).toHaveBeenCalledWith([expect.objectContaining({ status: 'completed' })]);
    expect(timers.pendingCount).toBe(0);
  });

  it('does not settle loading for a superseded response before the latest refresh settles', async () => {
    let resolveStaleList!: (jobs: PipelineJobListItem[]) => void;
    let resolveFreshList!: (jobs: PipelineJobListItem[]) => void;
    const listJobs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((resolve) => {
            resolveStaleList = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((resolve) => {
            resolveFreshList = resolve;
          }),
      );
    const onTickSettled = vi.fn();
    const poller = createLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      onTickSettled,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    const latestRefresh = poller.tickNow();
    resolveStaleList([makeJob('j1', 'extracting', 1)]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(onTickSettled).not.toHaveBeenCalled();

    resolveFreshList([makeJob('j1', 'completed', 0)]);
    await latestRefresh;

    expect(onTickSettled).toHaveBeenCalledTimes(1);
  });

  it('does not schedule an error retry for a superseded response', async () => {
    let rejectStaleList!: (error: unknown) => void;
    const listJobs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((_, reject) => {
            rejectStaleList = reject;
          }),
      )
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]);
    const scheduledDelays: number[] = [];
    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => {
        scheduledDelays.push(ms);
        return timers.schedule(fn, ms);
      },
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    const latestRefresh = poller.tickNow();
    rejectStaleList(new Error('stale network failure'));
    await latestRefresh;

    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(scheduledDelays).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 4. List error schedules a retry at MAX (10000ms), doesn't throw
  // -------------------------------------------------------------------------
  it('list error schedules retry at MAX_DELAY_MS and does not throw', async () => {
    const listError = new Error('network error');
    const listJobs = vi
      .fn()
      .mockRejectedValueOnce(listError) // first call fails
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]); // second call succeeds → terminal

    const onJobs = vi.fn();

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs,
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Drain the first (failing) tick.
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // Error path: a timer should be scheduled (not 0 — some MAX delay).
    expect(timers.pendingCount).toBe(1);
    // onJobs should NOT have been called (error occurred before onJobs).
    expect(onJobs).not.toHaveBeenCalled();

    // Advance by MAX_DELAY_MS (10000ms) to trigger the retry.
    await timers.advanceBy(10_000);

    // Second call should have fired and returned completed → no more timers.
    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(onJobs).toHaveBeenCalledTimes(1);
    expect(timers.pendingCount).toBe(0);
  });

  it('reports when the initial library request settles, including errors', async () => {
    const onTickSettled = vi.fn();
    const poller = createLibraryPoller({
      listJobs: vi.fn().mockRejectedValue(new Error('network error')),
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      onTickSettled,
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(onTickSettled).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 6. Missing retry hints use the minimum polling delay
  // -------------------------------------------------------------------------
  it('uses the minimum polling delay when retry_after_seconds is missing', async () => {
    const activeJob = makeJob('j1', 'extracting');
    Reflect.deleteProperty(activeJob, 'retry_after_seconds');
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([activeJob])
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]);

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    await timers.advanceBy(999);
    expect(listJobs).toHaveBeenCalledTimes(1);

    await timers.advanceBy(1);
    expect(listJobs).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 7. stop() cancels the pending timer and prevents further fetches
  // -------------------------------------------------------------------------
  it('stop() cancels scheduled poll and prevents further fetches', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 2)]) // schedules next poll
      .mockResolvedValue([makeJob('j1', 'extracting', 2)]);

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Let first fetch resolve (schedules next poll ~2000ms away).
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(timers.pendingCount).toBe(1);

    // Stop before the timer fires.
    poller.stop();
    expect(timers.pendingCount).toBe(0);

    // Advance well past where the next poll would have fired.
    await timers.advanceBy(10_000);

    // Still only one call.
    expect(listJobs).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 8. In-flight guard prevents overlapping ticks
  // -------------------------------------------------------------------------
  it('does not double-fetch while a tick is in-flight', async () => {
    let resolveFirst!: (v: PipelineJobListItem[]) => void;
    const listJobs = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PipelineJobListItem[]>((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValue([makeJob('j1', 'completed', 0)]);

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start(); // first tick starts; fetch is in-flight (unresolved)

    // Advance time — no timer fires because no schedule was called yet
    // (the first tick is still in-flight and hasn't returned yet).
    await timers.advanceBy(5_000);

    // Fetcher should have been called exactly once.
    expect(listJobs).toHaveBeenCalledTimes(1);

    // Resolve the in-flight fetch so the poller can clean up.
    resolveFirst([makeJob('j1', 'completed', 0)]);
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));
  });

  // -------------------------------------------------------------------------
  // 7. Delay clamping: retry_after_seconds > 10 is clamped to MAX_DELAY_MS
  // -------------------------------------------------------------------------
  it('clamps delay to MAX_DELAY_MS (10000ms) when retry_after_seconds is very large', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 60)]) // 60s → clamp to 10000ms
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]);

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // Should have scheduled at MAX_DELAY_MS = 10000ms.
    expect(timers.pendingCount).toBe(1);

    // Advance just under 10s — should not have fired yet.
    await timers.advanceBy(9_999);
    expect(listJobs).toHaveBeenCalledTimes(1);

    // Advance the remaining 1ms — should fire now.
    await timers.advanceBy(1);
    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(timers.pendingCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 8. Multiple active jobs: picks the shortest retry_after_seconds
  // -------------------------------------------------------------------------
  it('uses the shortest retry_after_seconds across all active jobs', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([
        makeJob('j1', 'extracting', 5),
        makeJob('j2', 'extracting', 2), // shortest — should govern delay
        makeJob('j3', 'extracting', 8),
      ])
      .mockResolvedValueOnce([
        makeJob('j1', 'completed', 0),
        makeJob('j2', 'completed', 0),
        makeJob('j3', 'completed', 0),
      ]);

    const scheduledDelays: number[] = [];

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => {
        scheduledDelays.push(ms);
        return timers.schedule(fn, ms);
      },
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // Delay should be based on min(5, 2, 8) * 1000 = 2000ms.
    expect(scheduledDelays[0]).toBe(2_000);

    // Advance to trigger second tick.
    await timers.advanceBy(2_500);
    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(timers.pendingCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 9. tickNow while stopped: resets stopped and runs a fresh tick
  // -------------------------------------------------------------------------
  it('tickNow resets stopped state and runs a fresh tick', async () => {
    const listJobs = vi
      .fn()
      .mockResolvedValueOnce([makeJob('j1', 'completed', 0)]) // first tick → stop
      .mockResolvedValueOnce([makeJob('j1', 'extracting', 1)]); // tickNow → reschedules

    const onJobs = vi.fn();

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs,
      onBusy: vi.fn(),
      schedule: (fn, ms) => timers.schedule(fn, ms),
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();

    // Drain first tick (all terminal → stopped).
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(timers.pendingCount).toBe(0);

    // tickNow should reset stopped and run a fresh tick.
    await poller.tickNow();

    expect(listJobs).toHaveBeenCalledTimes(2);
    // Second tick found an active job → should have rescheduled.
    expect(timers.pendingCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 10. stop() called while listJobs error is in-flight: no retry scheduled
  // -------------------------------------------------------------------------
  it('stop() while listJobs throws does not schedule an error retry', async () => {
    let rejectList!: (err: unknown) => void;
    const listJobs = vi.fn().mockImplementationOnce(
      () =>
        new Promise<PipelineJobListItem[]>((_, rej) => {
          rejectList = rej;
        }),
    );

    const scheduledDelays: number[] = [];
    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs: vi.fn(),
      onBusy: vi.fn(),
      schedule: (fn, ms) => {
        scheduledDelays.push(ms);
        return timers.schedule(fn, ms);
      },
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    expect(listJobs).toHaveBeenCalledTimes(1);

    // Stop the poller while listJobs is still in-flight.
    poller.stop();

    // Reject listJobs — the catch block's `if (!stopped)` guard should prevent scheduling.
    rejectList(new Error('network failure'));
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // No timer should have been scheduled after stop() + error.
    expect(scheduledDelays).toHaveLength(0);
    expect(timers.pendingCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 11. stop() called while successful listJobs is in-flight: no reschedule
  // -------------------------------------------------------------------------
  it('stop() while listJobs succeeds does not call onJobs or reschedule', async () => {
    let resolveList!: (jobs: PipelineJobListItem[]) => void;
    const listJobs = vi.fn().mockImplementationOnce(
      () =>
        new Promise<PipelineJobListItem[]>((res) => {
          resolveList = res;
        }),
    );

    const onJobs = vi.fn();
    const scheduledDelays: number[] = [];

    const poller = createTestLibraryPoller({
      listJobs,
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      onJobs,
      onBusy: vi.fn(),
      schedule: (fn, ms) => {
        scheduledDelays.push(ms);
        return timers.schedule(fn, ms);
      },
      unschedule: (id) => timers.unschedule(id),
    });

    poller.start();
    expect(listJobs).toHaveBeenCalledTimes(1);

    // Stop before the promise resolves.
    poller.stop();

    // Resolve with an active job — but stopped is now true.
    resolveList([makeJob('j1', 'extracting', 1)]);
    await new Promise<void>((res) => setImmediate(res));
    await new Promise<void>((res) => setImmediate(res));

    // onJobs and schedule should not have been called.
    expect(onJobs).not.toHaveBeenCalled();
    expect(scheduledDelays).toHaveLength(0);
  });
});
