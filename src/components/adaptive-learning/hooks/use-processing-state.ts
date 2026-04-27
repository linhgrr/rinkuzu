'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AdaptiveApiError,
  createSessionFromPipeline,
  getPipelineJobStatus,
  isAdaptiveApiError,
  isRetryableAdaptiveError,
} from '../api-client';
import { ADAPTIVE_ROUTES } from '../routes';
import { saveSessionJobMapping } from '../session-storage';
import type { PipelineJobStatus, PipelineStatus } from '../types';

const STATUS_TO_STEP: Record<PipelineStatus, number> = {
  pending: 0,
  queued: 0,
  loading: 1,
  chunking: 1,
  extracting: 2,
  embedding: 3,
  merging: 3,
  ranking: 4,
  verifying: 4,
  building_graph: 5,
  optimizing: 5,
  completed: 6,
  failed: -1,
  cancelled: -1,
};

const STATUS_LABEL_KEYS: Record<PipelineStatus, string> = {
  pending: 'waitingToStart',
  queued: 'queuedForProcessing',
  loading: 'readingDocument',
  chunking: 'splittingChunks',
  extracting: 'extractingConceptsWithAI',
  embedding: 'computingEmbeddings',
  merging: 'mergingDuplicateConcepts',
  ranking: 'rankingPrerequisites',
  verifying: 'verifyingRelationsWithAI',
  building_graph: 'buildingKnowledgeGraph',
  optimizing: 'optimizingDAG',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
};

type TranslateFn = (key: string, values?: Record<string, any>) => string;

type ProcessingStats = {
  concepts_extracted: number;
  concepts_after_merge: number;
  relations_verified: number;
};

const BASE_POLL_DELAY_MS = 2_000;
const MAX_POLL_DELAY_MS = 10_000;
const TOAST_THROTTLE_WINDOW_MS = 4_000;

export type ProcessingStep = {
  id: number;
  label: string;
};

type ProcessingErrorState = {
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
  const [statusLabel, setStatusLabel] = useState('');
  const [error, setError] = useState<ProcessingErrorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [partialGraph, setPartialGraph] = useState<PipelineJobStatus['partial_graph']>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [filename, setFilename] = useState('');
  const [showGraphPanel, setShowGraphPanel] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const creatingSessionRef = useRef(false);
  const retryDelayRef = useRef(BASE_POLL_DELAY_MS);
  const pollJobRef = useRef<(jobId: string) => void>(() => {});
  const lastToastRef = useRef<{ message: string; at: number } | null>(null);

  const steps = useMemo<ProcessingStep[]>(
    () => [
      { id: 1, label: t('processing.steps.readingPdf') },
      { id: 2, label: t('processing.steps.extractingConcepts') },
      { id: 3, label: t('processing.steps.buildingGraph') },
      { id: 4, label: t('processing.steps.generatingPath') },
      { id: 5, label: t('processing.steps.preparingExercise') },
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
        if (err.code === 'temporary_unavailable')
          return {
            message: t('processing.errors.serviceUnavailable'),
            retryable: true,
            code: err.code,
            action: 'upload' as const,
          };
        if (err.code === 'request_aborted' || err.code === 'network_error')
          return {
            message: t('processing.errors.connectionInterrupted'),
            retryable: true,
            code: err.code,
            action: 'upload' as const,
          };
        if (err.code === 'pipeline_not_ready')
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
        return isAdaptiveApiError(err) && err.code === 'pipeline_not_ready'
          ? t('processing.notices.retryingCreateSession')
          : t('processing.notices.sessionSetupUnconfirmed');

      if (isAdaptiveApiError(err)) {
        if (err.code === 'request_aborted') return t('processing.notices.connectionInterrupted');
        if (err.code === 'temporary_unavailable' || err.code === 'network_error')
          return t('processing.notices.backendSlowRetrying');
      }

      return t('processing.notices.connectionInterrupted');
    },
    [t],
  );

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pollInFlightRef.current = false;
    retryDelayRef.current = BASE_POLL_DELAY_MS;
  }, []);

  const scheduleNextPoll = useCallback((jobId: string, delayMs = BASE_POLL_DELAY_MS) => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }

    pollingRef.current = setTimeout(() => {
      pollJobRef.current(jobId);
    }, delayMs);
  }, []);

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
      timeoutRef.current = setTimeout(() => {
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

  const handleCompletedJob = useCallback(
    async (jobId: string) => {
      creatingSessionRef.current = true;
      setCreatingSession(true);
      setNotice(null);

      try {
        const session = await createSessionFromPipeline(jobId, 50);
        clearPolling();
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        localStorage.removeItem('al_pipeline_job_id');
        toast.success(t('processing.status.completed'));
        timeoutRef.current = setTimeout(() => {
          router.push(ADAPTIVE_ROUTES.subject(session.session_id));
        }, 800);
      } catch (err) {
        setCreatingSession(false);
        creatingSessionRef.current = false;

        if (isRetryableAdaptiveError(err)) {
          clearPolling();
          const retryMessage = getRetryNotice(err, 'createSession');
          setNotice(retryMessage);
          pushThrottledToast(retryMessage);
          setError({
            message: t('processing.errors.sessionSetupUnconfirmed'),
            retryable: true,
            code: isAdaptiveApiError(err) ? err.code : 'session_setup_unconfirmed',
            action: 'dashboard',
          });
          return 'deferred';
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
    [clearPolling, getFriendlyProcessingError, getRetryNotice, pushThrottledToast, router, t],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      if (pollInFlightRef.current || creatingSessionRef.current) return;

      pollInFlightRef.current = true;

      try {
        const job = await getPipelineJobStatus(jobId);
        retryDelayRef.current = BASE_POLL_DELAY_MS;
        setNotice(null);
        setCurrentStep(STATUS_TO_STEP[job.status] ?? 0);
        setProgress(job.progress * 100);
        setStatusLabel(job.current_step || getStatusLabel(job.status));

        if (job.partial_graph) setPartialGraph(job.partial_graph);

        updateStats(job);

        if (job.status === 'completed' && !creatingSessionRef.current) {
          const outcome = await handleCompletedJob(jobId);
          if (outcome === 'deferred') return;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          clearPolling();
          setNotice(job.retryable ? t('processing.notices.retryAfterFailure') : null);
          const terminalError = getTerminalProcessingError(job);
          setError(terminalError);
          pushThrottledToast(terminalError.message);
        } else {
          scheduleNextPoll(jobId, BASE_POLL_DELAY_MS);
        }
      } catch (err) {
        if (isRetryableAdaptiveError(err)) {
          setNotice(getRetryNotice(err, 'polling'));
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_POLL_DELAY_MS);
          scheduleNextPoll(jobId, retryDelayRef.current);
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
      updateStats,
    ],
  );

  useEffect(() => {
    pollJobRef.current = (jobId: string) => {
      void pollJob(jobId);
    };
  }, [pollJob]);

  useEffect(() => {
    setStatusLabel(t('processing.status.starting'));
    setFilename(getStoredFilename(t('processing.defaultFilename')));
  }, [t]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const applyMatch = () => setShowGraphPanel(mediaQuery.matches);

    applyMatch();
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
    handleGoBack,
    notice,
    partialGraph,
    progress,
    showGraphPanel,
    stats,
    statusLabel,
    steps,
  };
};
