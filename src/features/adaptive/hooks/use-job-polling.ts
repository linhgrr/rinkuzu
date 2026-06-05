'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isRetryableAdaptiveError } from '@/features/adaptive/lib/api-client';
import type { PipelineJobStatus, PipelineStatus } from '@/features/adaptive/types';

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 10_000;
const JITTER_RATIO = 0.15;

const TERMINAL: ReadonlySet<PipelineStatus> = new Set(['completed', 'failed', 'cancelled']);

export type PollSnapshot = Pick<PipelineJobStatus, 'status' | 'progress'> & {
  retry_after_seconds?: number;
} & Record<string, unknown>;

export type UseJobPollingArgs<T extends PollSnapshot> = {
  jobId: string | null;
  enabled: boolean;
  fetcher: (jobId: string, signal: AbortSignal) => Promise<T>;
  onSnapshot?: (snap: T) => void;
  onTerminal?: (snap: T) => void;
  onError?: (err: unknown) => void;
};

// ---------------------------------------------------------------------------
// Pure, testable core — no React; holds all scheduling / in-flight logic.
// ---------------------------------------------------------------------------

export type JobPollerHandlers<T> = {
  onSnapshot?: (snap: T) => void;
  onTerminal?: (snap: T) => void;
  onError?: (err: unknown) => void;
};

export type JobPollerOptions<T extends PollSnapshot> = {
  jobId: string;
  fetcher: (jobId: string, signal: AbortSignal) => Promise<T>;
  handlers: JobPollerHandlers<T>;
  /** Override for testing — defaults to global setTimeout */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Override for testing — defaults to global clearTimeout */
  unschedule?: (id: ReturnType<typeof setTimeout>) => void;
};

export type JobPoller = {
  /** Kick off the first poll immediately. */
  start: () => void;
  /** Cancel any pending timer and abort the in-flight request. */
  stop: () => void;
};

export function createJobPoller<T extends PollSnapshot>({
  jobId,
  fetcher,
  handlers,
  schedule = setTimeout,
  unschedule = clearTimeout,
}: JobPollerOptions<T>): JobPoller {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let errorDelay = BASE_DELAY_MS;
  let stopped = false;
  let abortController: AbortController | null = null;

  const applyJitter = (ms: number): number =>
    Math.max(500, Math.round(ms * (1 + (Math.random() * 2 - 1) * JITTER_RATIO)));

  const clearTimer = () => {
    if (timerId !== null) {
      unschedule(timerId);
      timerId = null;
    }
  };

  const scheduleNext = (delayMs: number) => {
    clearTimer();
    if (stopped) return;
    timerId = schedule(() => void tick(), applyJitter(delayMs));
  };

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) return;

    inFlight = true;
    abortController = new AbortController();

    try {
      const snap = await fetcher(jobId, abortController.signal);
      if (stopped) return;

      errorDelay = BASE_DELAY_MS;
      handlers.onSnapshot?.(snap);

      if (TERMINAL.has(snap.status)) {
        stopped = true;
        clearTimer();
        handlers.onTerminal?.(snap);
        return;
      }

      scheduleNext(Math.max(1, snap.retry_after_seconds ?? 2) * 1_000);
    } catch (err) {
      if (stopped) return;

      if (isRetryableAdaptiveError(err)) {
        errorDelay = Math.min(errorDelay * 2, MAX_DELAY_MS);
        handlers.onError?.(err);
        scheduleNext(errorDelay);
        return;
      }

      stopped = true;
      clearTimer();
      handlers.onError?.(err);
    } finally {
      inFlight = false;
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
      abortController?.abort();
      abortController = null;
    },
  };
}

// ---------------------------------------------------------------------------
// React hook — thin wrapper around createJobPoller
// ---------------------------------------------------------------------------

export function useJobPolling<T extends PollSnapshot>({
  jobId,
  enabled,
  fetcher,
  onSnapshot,
  onTerminal,
  onError,
}: UseJobPollingArgs<T>) {
  const [snapshot, setSnapshot] = useState<T | null>(null);

  // Keep latest callbacks in refs so the effect doesn't re-run when they change.
  const onSnapshotRef = useRef(onSnapshot);
  const onTerminalRef = useRef(onTerminal);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const stableHandlers = useCallback(
    (): JobPollerHandlers<T> => ({
      onSnapshot: (snap) => {
        setSnapshot(snap);
        onSnapshotRef.current?.(snap);
      },
      onTerminal: (snap) => {
        setSnapshot(snap);
        onTerminalRef.current?.(snap);
      },
      onError: (err) => onErrorRef.current?.(err),
    }),
    [],
  );

  useEffect(() => {
    if (!enabled || !jobId) return;

    const stableFetcher: JobPollerOptions<T>['fetcher'] = (id, sig) => fetcherRef.current(id, sig);

    const poller = createJobPoller<T>({
      jobId,
      fetcher: stableFetcher,
      handlers: stableHandlers(),
    });

    poller.start();
    return () => poller.stop();
  }, [enabled, jobId, stableHandlers]);

  return { snapshot };
}
