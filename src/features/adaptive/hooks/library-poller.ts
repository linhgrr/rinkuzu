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
  let currentTick: Promise<void> | null = null;
  let lifecycleVersion = 0;
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

  const runTick = async (version: number): Promise<void> => {
    try {
      let jobs: PipelineJobListItem[];
      try {
        jobs = await listJobs();
      } catch {
        // On list error: schedule a retry at MAX delay, do not crash.
        if (!stopped && version === lifecycleVersion) {
          scheduleNext(MAX_DELAY_MS);
        }
        return;
      }

      if (stopped || version !== lifecycleVersion) return;

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
      if (version === lifecycleVersion) {
        onTickSettled();
      }
    }
  };

  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (currentTick) return currentTick;

    const promise = runTick(lifecycleVersion);
    currentTick = promise;
    const clearCurrentTick = (): void => {
      if (currentTick === promise) currentTick = null;
    };
    void promise.then(clearCurrentTick, clearCurrentTick);
    return promise;
  };

  const tickNow = async (): Promise<void> => {
    clearTimer();
    stopped = false;

    // Invalidate an older list response before waiting for it to settle. This keeps a
    // pre-mutation response from restoring stale state after retry/cancel completes.
    const requestedVersion = ++lifecycleVersion;
    const activeTick = currentTick;
    if (activeTick) await activeTick;

    // A newer refresh or stop supersedes this request while it is waiting.
    if (stopped || requestedVersion !== lifecycleVersion) return;

    clearTimer();
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
      void tickNow();
    },
    stop: () => {
      stopped = true;
      lifecycleVersion += 1;
      clearTimer();
    },
    tickNow,
    retry,
    cancel,
  };
}
