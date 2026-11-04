'use client';

import { useRouter } from '@/i18n/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AdaptiveApiError,
  adaptiveErrorForDisplay,
  isAdaptiveApiError,
  isAdaptivePipelineNotReadyError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
  isRetryableAdaptiveError,
} from '@/features/adaptive/lib/adaptive-api-error';
import {
  createSessionFromPipeline,
  getPipelineJobStatus,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { reportAdaptivePipelineTerminal } from '@/features/adaptive/lib/pipeline-analytics';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CODE_MESSAGE_KEYS, describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { MEDIA_MIN_LG } from '@/shared/constants/breakpoints';
import {
  clearSelectedPipelineJob,
  getSelectedPipelineFilename,
  getSelectedPipelineJobId,
  getSelectedPipelineTitle,
  saveActiveSessionId,
  saveSessionJobMapping,
} from '../lib/session-storage';
import { STATUS_LABEL_KEYS } from '../lib/pipeline-status-labels';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelineJobStatus, PipelineStatus } from '@/features/adaptive/types/pipeline';

const STATUS_TO_STEP: Record<PipelineStatus, number> = {
  pending: 0,
  queued: 0,
  loading: 1,
  chunking: 1,
  extracting: 2,
  embedding: 3,
  merging: 4,
  ranking: 4,
  verifying: 5,
  building_graph: 5,
  optimizing: 6,
  completed: 6,
  failed: -1,
  cancelled: -1,
};

export type ProcessingStats = {
  concepts_extracted: number;
  concepts_after_merge: number;
  relations_accepted: number;
};

const BASE_POLL_DELAY_MS = 2_000;
const MAX_POLL_DELAY_MS = 10_000;
const POLL_JITTER_RATIO = 0.15;
const CREATE_SESSION_MAX_RETRIES = 5;
const TOAST_THROTTLE_WINDOW_MS = 4_000;

function getBackoffDelay(attempt: number) {
  return Math.min(BASE_POLL_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_POLL_DELAY_MS);
}

function getJitteredDelay(delayMs: number) {
  const jitter = 1 + (Math.random() * 2 - 1) * POLL_JITTER_RATIO;
  return Math.max(500, Math.round(delayMs * jitter));
}

export type ProcessingStep = {
  id: number;
  label: string;
};

export type ProcessingErrorState = {
  /** Localized copy only (rendered by ProcessingSections); never server text (RIN-754). */
  message: string;
  retryable: boolean;
  code: string | null;
  action: 'upload' | 'dashboard';
};

export const useProcessingState = (t: TranslateFn) => {
  const router = useRouter();
  const apiErrorMessage = useApiErrorMessage();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState(() => t('processing.status.starting'));
  const [error, setError] = useState<ProcessingErrorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [partialGraph, setPartialGraph] = useState<PipelineJobStatus['partial_graph']>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const filename = getSelectedPipelineFilename(t('processing.defaultFilename'));
  const subjectTitle = getSelectedPipelineTitle(filename);
  // Reactive viewport flag — the shared hook seeds the initial value on mount
  // (the previous inline effect only updated on change, missing first paint).
  const showGraphPanel = useMediaQuery(MEDIA_MIN_LG);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollWaitResolveRef = useRef<(() => void) | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const creatingSessionRef = useRef(false);
  const pollRetryDelayRef = useRef(BASE_POLL_DELAY_MS);
  const createSessionRetryCountRef = useRef(0);
  const lastToastRef = useRef<{ message: string; at: number } | null>(null);

  const steps: ProcessingStep[] = [
    { id: 1, label: t('processing.steps.readingPdf') },
    { id: 2, label: t('processing.steps.extractingConcepts') },
    { id: 3, label: t('processing.steps.computingEmbeddings') },
    { id: 4, label: t('processing.steps.mergingAndRanking') },
    { id: 5, label: t('processing.steps.verifyingAndBuildingGraph') },
    { id: 6, label: t('processing.steps.finalizingSession') },
  ];

  const getStatusLabel = (status: PipelineStatus) =>
    t(`processing.status.${STATUS_LABEL_KEYS[status]}`);

  const getFriendlyProcessingError = (err: unknown) => {
    if (err instanceof AdaptiveApiError) {
      if (err.code === 'unauthorized')
        return {
          message: t('processing.errors.unauthorized'),
          retryable: false,
          code: err.code,
          action: 'upload' as const,
        };
      if (err.code === 'not_found')
        return {
          message: t('processing.errors.jobNotFound'),
          retryable: false,
          code: err.code,
          action: 'upload' as const,
        };
      if (err.code === 'conflict')
        return {
          message: t('processing.errors.conflict'),
          retryable: false,
          code: err.code,
          action: 'upload' as const,
        };
      if (isAdaptiveServiceUnavailableError(err))
        return {
          message: t('processing.errors.serviceUnavailable'),
          retryable: true,
          code: err.code,
          action: 'upload' as const,
        };
      if (isAdaptiveRequestAbortedError(err))
        return {
          message: t('processing.errors.connectionInterrupted'),
          retryable: true,
          code: err.code,
          action: 'upload' as const,
        };
      if (isAdaptivePipelineNotReadyError(err))
        return {
          message: t('processing.errors.sessionNotReady'),
          retryable: true,
          code: err.code,
          action: 'dashboard' as const,
        };
    }

    // Never the error's own text (RIN-754): copy comes from its code or kind.
    const shown = adaptiveErrorForDisplay(err);
    return {
      message:
        describeApiError(shown).kind === 'unknown'
          ? t('processing.errors.generic')
          : apiErrorMessage(shown) || t('processing.errors.generic'),
      retryable: false,
      code: isAdaptiveApiError(err) ? err.code : null,
      action: 'upload' as const,
    };
  };

  const getTerminalProcessingError = (job: PipelineJobStatus): ProcessingErrorState => {
    const code = job.error_code ?? null;

    if (code === 'pipeline_timeout') {
      return {
        message: t('processing.errors.pipelineTimeout'),
        retryable: Boolean(job.retryable),
        code,
        action: 'upload',
      };
    }

    if (code === 'pipeline_cancelled' || job.status === 'cancelled') {
      return {
        message: t('processing.errors.pipelineCancelled'),
        retryable: true,
        code: code ?? 'pipeline_cancelled',
        action: 'upload',
      };
    }

    if (code === 'pipeline_unavailable') {
      return {
        message: t('processing.errors.pipelineUnavailable'),
        retryable: true,
        code,
        action: 'upload',
      };
    }

    // `job.user_message` is server text; codes with their own copy (pipeline_stalled,
    // quota_exceeded, unsupported_media_type, ...) use the shared error keys (RIN-754).
    if (code && CODE_MESSAGE_KEYS[code]) {
      return {
        message: apiErrorMessage({ code }),
        retryable: Boolean(job.retryable),
        code,
        action: 'upload',
      };
    }

    return {
      message: t('processing.errors.pipelineFailed'),
      retryable: Boolean(job.retryable),
      code,
      action: 'upload',
    };
  };

  const getRetryNotice = (err: unknown, phase: 'polling' | 'createSession') => {
    if (phase === 'createSession')
      return isAdaptivePipelineNotReadyError(err)
        ? t('processing.notices.retryingCreateSession')
        : t('processing.notices.sessionSetupUnconfirmed');

    if (isAdaptiveApiError(err)) {
      if (isAdaptiveRequestAbortedError(err)) return t('processing.notices.connectionInterrupted');
      if (isAdaptiveServiceUnavailableError(err))
        return t('processing.notices.backendSlowRetrying');
    }

    return t('processing.notices.connectionInterrupted');
  };

  const clearPollingTimer = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    // Unblock the Effect schedule loop if it is mid-delay.
    if (pollWaitResolveRef.current) {
      const resolve = pollWaitResolveRef.current;
      pollWaitResolveRef.current = null;
      resolve();
    }
  };

  const clearNavigationTimeout = () => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  };

  const clearPolling = () => {
    clearPollingTimer();
    clearNavigationTimeout();
    pollInFlightRef.current = false;
    pollRetryDelayRef.current = BASE_POLL_DELAY_MS;
    createSessionRetryCountRef.current = 0;
  };

  const pushThrottledToast = (message: string) => {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.message === message && now - last.at < TOAST_THROTTLE_WINDOW_MS) return;
    lastToastRef.current = { message, at: now };
    toast.error(message);
  };

  const updateStats = (job: PipelineJobStatus) => {
    if (job.concepts_extracted <= 0) return;

    setStats((prev) => {
      if (
        prev &&
        prev.concepts_extracted === job.concepts_extracted &&
        prev.concepts_after_merge === job.concepts_after_merge &&
        prev.relations_accepted === job.relations_accepted
      )
        return prev;

      return {
        concepts_extracted: job.concepts_extracted,
        concepts_after_merge: job.concepts_after_merge,
        relations_accepted: job.relations_accepted,
      };
    });
  };

  const updatePipelineNotice = (job: PipelineJobStatus) => {
    const batchCount = job.batch_count;
    const failedBatchCount = job.failed_batch_count;
    const partialSuccess = Boolean(job.partial_success);

    if (partialSuccess && failedBatchCount > 0) {
      setNotice(
        t('processing.notices.partialSuccess', {
          failed: failedBatchCount,
          total: Math.max(batchCount, failedBatchCount),
        }),
      );
      return;
    }

    if (job.is_delayed) {
      setNotice(t('processing.notices.processingTakingLonger'));
      return;
    }

    setNotice(null);
  };

  /**
   * One poll tick. Returns delay (ms) before the next tick, or null to stop.
   * Scheduling lives in the Effect (React docs timer pattern) — not a ref bridge.
   */
  const onPollJob = useEffectEvent(async (jobId: string): Promise<number | null> => {
    const handleCompletedJob = async (): Promise<'created' | 'failed' | 'retrying'> => {
      creatingSessionRef.current = true;
      setCreatingSession(true);

      try {
        const session = await createSessionFromPipeline(jobId, 50);
        clearPolling();
        saveActiveSessionId(session.session_id);
        saveSessionJobMapping(session.session_id, jobId, {
          filename,
          subjectName: subjectTitle,
        });
        clearSelectedPipelineJob();
        toast.success(t('processing.status.completed'));
        navigationTimeoutRef.current = setTimeout(() => {
          router.push(ADAPTIVE_ROUTES.subject(session.session_id));
        }, 800);
        return 'created';
      } catch (err) {
        setCreatingSession(false);
        creatingSessionRef.current = false;

        if (isRetryableAdaptiveError(err)) {
          const retryMessage = getRetryNotice(err, 'createSession');
          const nextAttempt = createSessionRetryCountRef.current + 1;
          createSessionRetryCountRef.current = nextAttempt;
          setNotice(retryMessage);
          pushThrottledToast(retryMessage);

          if (nextAttempt >= CREATE_SESSION_MAX_RETRIES) {
            clearPolling();
            setError({
              message: t('processing.errors.sessionSetupUnconfirmed'),
              retryable: true,
              code: isAdaptiveApiError(err) ? err.code : 'session_setup_unconfirmed',
              action: 'dashboard',
            });
            return 'failed';
          }

          return 'retrying';
        }

        const friendlyError = getFriendlyProcessingError(err);
        setError({
          ...friendlyError,
          action: 'dashboard',
        });
        pushThrottledToast(friendlyError.message);
        clearPolling();
        return 'failed';
      }
    };

    if (pollInFlightRef.current || creatingSessionRef.current) return null;

    pollInFlightRef.current = true;
    const releasePollLock = () => {
      pollInFlightRef.current = false;
    };

    try {
      const job = await getPipelineJobStatus(jobId);
      pollRetryDelayRef.current = BASE_POLL_DELAY_MS;
      setCurrentStep(STATUS_TO_STEP[job.status]);
      setProgress(job.progress * 100);
      setStatusLabel(job.current_step || getStatusLabel(job.status));

      if (job.partial_graph) setPartialGraph(job.partial_graph);

      updateStats(job);
      updatePipelineNotice(job);
      reportAdaptivePipelineTerminal(job);

      if (job.status === 'completed' && !creatingSessionRef.current) {
        const outcome = await handleCompletedJob();
        if (outcome === 'retrying') {
          releasePollLock();
          return getJitteredDelay(getBackoffDelay(createSessionRetryCountRef.current));
        }
        releasePollLock();
        return null;
      }

      if (job.status === 'failed' || job.status === 'cancelled') {
        clearPolling();
        setNotice(job.retryable ? t('processing.notices.retryAfterFailure') : null);
        const terminalError = getTerminalProcessingError(job);
        setError(terminalError);
        pushThrottledToast(terminalError.message);
        releasePollLock();
        return null;
      }

      createSessionRetryCountRef.current = 0;
      releasePollLock();
      return getJitteredDelay(Math.max(1, job.retry_after_seconds ?? 2) * 1000);
    } catch (err) {
      if (isRetryableAdaptiveError(err)) {
        setNotice(getRetryNotice(err, 'polling'));
        pollRetryDelayRef.current = Math.min(pollRetryDelayRef.current * 2, MAX_POLL_DELAY_MS);
        releasePollLock();
        return getJitteredDelay(pollRetryDelayRef.current);
      }

      clearPolling();
      const friendlyError = getFriendlyProcessingError(err);
      setError(friendlyError);
      pushThrottledToast(friendlyError.message);
      releasePollLock();
      return null;
    }
  });

  // Reactive Effect owns the schedule loop; onPollJob (Effect Event) reads latest state.
  useEffect(() => {
    const jobId = getSelectedPipelineJobId();
    if (!jobId) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setError({
          message: t('processing.errors.jobNotFound'),
          retryable: false,
          code: 'pipeline_job_missing',
          action: 'upload',
        });
      });
      return () => {
        active = false;
      };
    }

    let cancelled = false;
    creatingSessionRef.current = false;

    const runLoop = async () => {
      while (!cancelled) {
        const nextDelayMs = await onPollJob(jobId);
        if (cancelled || nextDelayMs == null) break;
        await new Promise<void>((resolve) => {
          pollWaitResolveRef.current = resolve;
          pollingRef.current = setTimeout(() => {
            pollingRef.current = null;
            pollWaitResolveRef.current = null;
            resolve();
          }, nextDelayMs);
        });
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      clearPolling();
    };
    // onPollJob is useEffectEvent — must not appear in deps (react.dev).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleGoBack = () => {
    clearPolling();
    creatingSessionRef.current = false;
    setNotice(null);
    clearSelectedPipelineJob();
    router.push(ADAPTIVE_ROUTES.upload);
  };

  const handleErrorAction = () => {
    if (error?.action === 'dashboard') {
      clearPolling();
      router.push(ADAPTIVE_ROUTES.dashboard);
      return;
    }

    handleGoBack();
  };

  return {
    creatingSession,
    currentStep,
    error,
    handleErrorAction,
    filename,
    notice,
    partialGraph,
    progress,
    showGraphPanel,
    stats,
    statusLabel,
    steps,
  };
};
