import type { PipelineJobListItem, PipelineStatus } from '@/features/adaptive/types/pipeline';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

const TERMINAL: ReadonlySet<PipelineStatus> = new Set(['completed', 'failed', 'cancelled']);

function isTerminal(status: PipelineStatus): boolean {
  return TERMINAL.has(status);
}

export type LibraryPollerOptions = {
  listJobs: () => Promise<PipelineJobListItem[]>;
  retryJob: (jobId: string) => Promise<unknown>;
  cancelJob: (jobId: string) => Promise<unknown>;
  onJobs: (jobs: PipelineJobListItem[]) => void;
  onBusy: (jobId: string | null) => void;
  onTickSettled: () => void;
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
  onTickSettled,
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
      onTickSettled();
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
