'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AdaptiveApiError,
  createSessionFromPipeline,
  getPipelineJobStatus,
  isAdaptiveApiError,
  isAdaptivePipelineNotReadyError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
  isRetryableAdaptiveError,
} from '@/features/adaptive/lib/api-client';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { saveSessionJobMapping } from '../lib/session-storage';
import { STATUS_LABEL_KEYS } from '../lib/pipeline-status-labels';
import type { PipelineJobStatus, PipelineStatus } from '@/features/adaptive/types';

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

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

export type ProcessingStats = {
  concepts_extracted: number;
  concepts_after_merge: number;
  relations_verified: number;
};

const BASE_POLL_DELAY_MS = 2_000;
const MAX_POLL_DELAY_MS = 10_000;
const POLL_JITTER_RATIO = 0.15;
const CREATE_SESSION_MAX_RETRIES = 5;
const TOAST_THROTTLE_WINDOW_MS = 4_000;

export type ProcessingStep = {
  id: number;
  label: string;
};

export type ProcessingErrorState = {
  message: string;
  retryable: boolean;
  code: string | null;
  action: 'upload' | 'dashboard';
};

const getStoredFilename = (fallback: string) =>
  localStorage.getItem('al_pipeline_filename') || fallback;

export const useProcessingState = (t: TranslateFn) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState(() => t('processing.status.starting'));
  const [error, setError] = useState<ProcessingErrorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [partialGraph, setPartialGraph] = useState<PipelineJobStatus['partial_graph']>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const filename = useMemo(() => getStoredFilename(t('processing.defaultFilename')), [t]);
  const [showGraphPanel, setShowGraphPanel] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const creatingSessionRef = useRef(false);
  const pollRetryDelayRef = useRef(BASE_POLL_DELAY_MS);
  const createSessionRetryCountRef = useRef(0);
  const pollJobRef = useRef<(jobId: string) => void>(() => {});
  const lastToastRef = useRef<{ message: string; at: number } | null>(null);

  const steps = useMemo<ProcessingStep[]>(
    () => [
      { id: 1, label: t('processing.steps.readingPdf') },
      { id: 2, label: t('processing.steps.extractingConcepts') },
      { id: 3, label: t('processing.steps.computingEmbeddings') },
      { id: 4, label: t('processing.steps.mergingAndRanking') },
      { id: 5, label: t('processing.steps.verifyingAndBuildingGraph') },
      { id: 6, label: t('processing.steps.finalizingSession') },
    ],
    [t],
  );

  const getStatusLabel = useCallback(
    (status: PipelineStatus) => t(`processing.status.${STATUS_LABEL_KEYS[status]}`),
    [t],
  );

  const getFriendlyProcessingError = useCallback(
    (err: unknown) => {
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

      return {
        message: err instanceof Error ? err.message : t('processing.errors.generic'),
        retryable: false,
        code: null,
        action: 'upload' as const,
      };
    },
    [t],
  );

  const getTerminalProcessingError = useCallback(
    (job: PipelineJobStatus): ProcessingErrorState => {
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

      if (job.user_message?.trim()) {
        return {
          message: job.user_message,
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
    },
    [t],
  );

  const getRetryNotice = useCallback(
    (err: unknown, phase: 'polling' | 'createSession') => {
      if (phase === 'createSession')
        return isAdaptivePipelineNotReadyError(err)
          ? t('processing.notices.retryingCreateSession')
          : t('processing.notices.sessionSetupUnconfirmed');

      if (isAdaptiveApiError(err)) {
        if (isAdaptiveRequestAbortedError(err))
          return t('processing.notices.connectionInterrupted');
        if (isAdaptiveServiceUnavailableError(err))
          return t('processing.notices.backendSlowRetrying');
      }

      return t('processing.notices.connectionInterrupted');
    },
    [t],
  );

  const clearPollingTimer = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const clearNavigationTimeout = useCallback(() => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  }, []);

  const clearPolling = useCallback(() => {
    clearPollingTimer();
    clearNavigationTimeout();
    pollInFlightRef.current = false;
    pollRetryDelayRef.current = BASE_POLL_DELAY_MS;
    createSessionRetryCountRef.current = 0;
  }, [clearNavigationTimeout, clearPollingTimer]);

  const getBackoffDelay = useCallback(
    (attempt: number) =>
      Math.min(BASE_POLL_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_POLL_DELAY_MS),
    [],
  );

  const getJitteredDelay = useCallback((delayMs: number) => {
    const jitter = 1 + (Math.random() * 2 - 1) * POLL_JITTER_RATIO;
    return Math.max(500, Math.round(delayMs * jitter));
  }, []);

  const scheduleNextPoll = useCallback(
    (jobId: string, delayMs = BASE_POLL_DELAY_MS) => {
      clearPollingTimer();

      pollingRef.current = setTimeout(() => {
        pollJobRef.current(jobId);
      }, getJitteredDelay(delayMs));
    },
    [clearPollingTimer, getJitteredDelay],
  );

  const pushThrottledToast = useCallback((message: string) => {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.message === message && now - last.at < TOAST_THROTTLE_WINDOW_MS) return;
    lastToastRef.current = { message, at: now };
    toast.error(message);
  }, []);

  const runFallbackProgress = useCallback(() => {
    const totalDuration = 5000;
    const interval = 50;
    const increment = 100 / (totalDuration / interval);
    let currentProgress = 0;

    clearPolling();
    setStatusLabel(t('processing.status.processing'));
    pollingRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + increment, 100);
      setProgress(currentProgress);

      const step = Math.min(Math.ceil((currentProgress / 100) * steps.length), steps.length);
      setCurrentStep(step);

      if (currentProgress < 100) return;

      clearPolling();
      const sessionId = localStorage.getItem('al_session_id');
      navigationTimeoutRef.current = setTimeout(() => {
        if (sessionId) {
          router.push(ADAPTIVE_ROUTES.subject(sessionId));
          return;
        }

        router.push(ADAPTIVE_ROUTES.upload);
      }, 800);
    }, interval);
  }, [clearPolling, router, steps.length, t]);

  const updateStats = useCallback((job: PipelineJobStatus) => {
    if (job.concepts_extracted <= 0) return;

    setStats((prev) => {
      if (
        prev &&
        prev.concepts_extracted === job.concepts_extracted &&
        prev.concepts_after_merge === job.concepts_after_merge &&
        prev.relations_verified === job.relations_verified
      )
        return prev;

      return {
        concepts_extracted: job.concepts_extracted,
        concepts_after_merge: job.concepts_after_merge,
        relations_verified: job.relations_verified,
      };
    });
  }, []);

  const updatePipelineNotice = useCallback(
    (job: PipelineJobStatus) => {
      const batchCount = job.batch_count ?? 0;
      const failedBatchCount = job.failed_batch_count ?? 0;
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
    },
    [t],
  );

  const handleCompletedJob = useCallback(
    async (jobId: string) => {
      creatingSessionRef.current = true;
      setCreatingSession(true);

      try {
        const session = await createSessionFromPipeline(jobId, 50);
        clearPolling();
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        localStorage.removeItem('al_pipeline_job_id');
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

          scheduleNextPoll(jobId, getBackoffDelay(nextAttempt));
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
    },
    [
      clearPolling,
      getBackoffDelay,
      getFriendlyProcessingError,
      getRetryNotice,
      pushThrottledToast,
      router,
      scheduleNextPoll,
      t,
    ],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      if (pollInFlightRef.current || creatingSessionRef.current) return;

      pollInFlightRef.current = true;

      try {
        const job = await getPipelineJobStatus(jobId);
        pollRetryDelayRef.current = BASE_POLL_DELAY_MS;
        setCurrentStep(STATUS_TO_STEP[job.status] ?? 0);
        setProgress(job.progress * 100);
        setStatusLabel(job.current_step || getStatusLabel(job.status));

        if (job.partial_graph) setPartialGraph(job.partial_graph);

        updateStats(job);
        updatePipelineNotice(job);

        if (job.status === 'completed' && !creatingSessionRef.current) {
          const outcome = await handleCompletedJob(jobId);
          if (outcome === 'retrying') return;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          clearPolling();
          setNotice(job.retryable ? t('processing.notices.retryAfterFailure') : null);
          const terminalError = getTerminalProcessingError(job);
          setError(terminalError);
          pushThrottledToast(terminalError.message);
        } else {
          createSessionRetryCountRef.current = 0;
          scheduleNextPoll(jobId, Math.max(1, job.retry_after_seconds ?? 2) * 1000);
        }
      } catch (err) {
        if (isRetryableAdaptiveError(err)) {
          setNotice(getRetryNotice(err, 'polling'));
          pollRetryDelayRef.current = Math.min(pollRetryDelayRef.current * 2, MAX_POLL_DELAY_MS);
          scheduleNextPoll(jobId, pollRetryDelayRef.current);
          return;
        }

        clearPolling();
        const friendlyError = getFriendlyProcessingError(err);
        setError(friendlyError);
        pushThrottledToast(friendlyError.message);
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [
      clearPolling,
      getFriendlyProcessingError,
      getRetryNotice,
      getStatusLabel,
      getTerminalProcessingError,
      handleCompletedJob,
      scheduleNextPoll,
      pushThrottledToast,
      t,
      updatePipelineNotice,
      updateStats,
    ],
  );

  useEffect(() => {
    pollJobRef.current = (jobId: string) => {
      void pollJob(jobId);
    };
  }, [pollJob]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const applyMatch = () => setShowGraphPanel(mediaQuery.matches);

    mediaQuery.addEventListener('change', applyMatch);

    return () => {
      mediaQuery.removeEventListener('change', applyMatch);
    };
  }, []);

  useEffect(() => {
    const jobId = localStorage.getItem('al_pipeline_job_id');
    if (!jobId) {
      runFallbackProgress();
      return () => clearPolling();
    }

    creatingSessionRef.current = false;
    void pollJob(jobId);

    return () => clearPolling();
  }, [clearPolling, pollJob, runFallbackProgress]);

  const handleGoBack = useCallback(() => {
    clearPolling();
    creatingSessionRef.current = false;
    setNotice(null);
    localStorage.removeItem('al_pipeline_job_id');
    localStorage.removeItem('al_pipeline_filename');
    router.push(ADAPTIVE_ROUTES.upload);
  }, [clearPolling, router]);

  const handleErrorAction = useCallback(() => {
    if (error?.action === 'dashboard') {
      clearPolling();
      router.push(ADAPTIVE_ROUTES.dashboard);
      return;
    }

    handleGoBack();
  }, [clearPolling, error?.action, handleGoBack, router]);

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
