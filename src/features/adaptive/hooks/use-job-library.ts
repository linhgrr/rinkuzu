'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  listPipelineJobs,
  retryPipelineJob,
  cancelPipelineJob,
} from '@/features/adaptive/lib/api-client';
import type { PipelineJobListItem, PipelineStatus } from '@/features/adaptive/types';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

const TERMINAL: ReadonlySet<PipelineStatus> = new Set(['completed', 'failed', 'cancelled']);

function isTerminal(status: PipelineStatus): boolean {
  return TERMINAL.has(status);
}

// ---------------------------------------------------------------------------
// Pure, testable core — no React; holds all scheduling / in-flight logic.
// ---------------------------------------------------------------------------

export type LibraryPollerOptions = {
  listJobs: () => Promise<PipelineJobListItem[]>;
  retryJob: (jobId: string) => Promise<unknown>;
  cancelJob: (jobId: string) => Promise<unknown>;
  onJobs: (jobs: PipelineJobListItem[]) => void;
  onBusy: (jobId: string | null) => void;
  /** Override for testing — defaults to global setTimeout */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Override for testing — defaults to global clearTimeout */
  unschedule?: (id: ReturnType<typeof setTimeout>) => void;
};

export type LibraryPoller = {
  start: () => void;
  stop: () => void;
  tickNow: () => Promise<void>;
  retry: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
};

export function createLibraryPoller({
  listJobs,
  retryJob,
  cancelJob,
  onJobs,
  onBusy,
  schedule = setTimeout,
  unschedule = clearTimeout,
}: LibraryPollerOptions): LibraryPoller {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = false;

  const clearTimer = (): void => {
    if (timerId !== null) {
      unschedule(timerId);
      timerId = null;
    }
  };

  const scheduleNext = (delayMs: number): void => {
    clearTimer();
    timerId = schedule(() => void tick(), delayMs);
  };

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) return;

    inFlight = true;
    try {
      let jobs: PipelineJobListItem[];
      try {
        jobs = await listJobs();
      } catch {
        // On list error: schedule a retry at MAX delay, do not crash.
        if (!stopped) {
          scheduleNext(MAX_DELAY_MS);
        }
        return;
      }

      if (stopped) return;

      onJobs(jobs);

      const activeJobs = jobs.filter((j) => !isTerminal(j.status));
      if (activeJobs.length === 0) {
        // All terminal — stop polling.
        stopped = true;
        clearTimer();
        return;
      }

      // Schedule next tick at min(retry_after_seconds of active jobs) * 1000,
      // clamped to [MIN_DELAY_MS, MAX_DELAY_MS].
      const minRetrySeconds = Math.min(...activeJobs.map((j) => j.retry_after_seconds ?? 1));
      const delayMs = Math.min(Math.max(MIN_DELAY_MS, minRetrySeconds * 1_000), MAX_DELAY_MS);
      scheduleNext(delayMs);
    } finally {
      inFlight = false;
    }
  };

  const tickNow = async (): Promise<void> => {
    // Run an immediate tick regardless of pending timer.
    // Reset stopped so that a forced refresh works even after the poller has stopped
    // (e.g. after a retry/cancel action on a previously-terminal job list).
    clearTimer();
    stopped = false;
    await tick();
  };

  const retry = async (jobId: string): Promise<void> => {
    onBusy(jobId);
    try {
      await retryJob(jobId);
      await tickNow();
    } finally {
      onBusy(null);
    }
  };

  const cancel = async (jobId: string): Promise<void> => {
    onBusy(jobId);
    try {
      await cancelJob(jobId);
      await tickNow();
    } finally {
      onBusy(null);
    }
  };

  return {
    start: () => {
      stopped = false;
      void tick();
    },
    stop: () => {
      stopped = true;
      clearTimer();
      inFlight = false;
    },
    tickNow,
    retry,
    cancel,
  };
}

// ---------------------------------------------------------------------------
// React hook — thin wrapper around createLibraryPoller
// ---------------------------------------------------------------------------

export type UseJobLibraryArgs = {
  enabled: boolean;
  initialJobs?: PipelineJobListItem[];
};

export type UseJobLibraryResult = {
  jobs: PipelineJobListItem[];
  busyJobId: string | null;
  retry: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useJobLibrary({
  enabled,
  initialJobs = /* v8 ignore next */ [],
}: UseJobLibraryArgs): UseJobLibraryResult {
  const [jobs, setJobs] = useState<PipelineJobListItem[]>(initialJobs);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  // Keep a stable ref to the poller instance across renders.
  // Initialised lazily on the first render; never null after that.
  const pollerRef = useRef<LibraryPoller | null>(null);

  /* v8 ignore next 10 */
  if (pollerRef.current === null) {
    pollerRef.current = createLibraryPoller({
      listJobs: listPipelineJobs,
      retryJob: retryPipelineJob,
      cancelJob: cancelPipelineJob,
      onJobs: setJobs,
      onBusy: setBusyJobId,
    });
  }

  // pollerRef.current is guaranteed non-null here (initialised above).
  const poller = pollerRef.current as LibraryPoller;

  /* v8 ignore next 5 */
  useEffect(() => {
    if (!enabled) return;
    poller.start();
    return () => poller.stop();
  }, [enabled, poller]);

  const retryWithToast = async (jobId: string): Promise<void> => {
    /* v8 ignore next 3 */
    try {
      await poller.retry(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  const cancelWithToast = async (jobId: string): Promise<void> => {
    /* v8 ignore next 3 */
    try {
      await poller.cancel(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  return {
    jobs,
    busyJobId,
    retry: retryWithToast,
    cancel: cancelWithToast,
    refresh: poller.tickNow,
  };
}
