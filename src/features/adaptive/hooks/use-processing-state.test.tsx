/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelineJobStatus, PipelineStatus } from '@/features/adaptive/types/pipeline';
import { MEDIA_MIN_LG } from '@/shared/constants/breakpoints';

// The analytics client reads the GA id at import; its dataLayer is the observable sink.
vi.hoisted(() => {
  process.env['NEXT_PUBLIC_GA_ID'] = 'G-TEST123';
});

const {
  pushMock,
  getPipelineJobStatusMock,
  createSessionFromPipelineMock,
  retryPipelineJobMock,
  getSelectedPipelineJobIdMock,
  getSelectedPipelineFilenameMock,
  getSelectedPipelineTitleMock,
  clearSelectedPipelineJobMock,
  saveActiveSessionIdMock,
  saveSessionJobMappingMock,
  useMediaQueryMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  getPipelineJobStatusMock: vi.fn(),
  createSessionFromPipelineMock: vi.fn(),
  retryPipelineJobMock: vi.fn(),
  getSelectedPipelineJobIdMock: vi.fn(),
  getSelectedPipelineFilenameMock: vi.fn(),
  getSelectedPipelineTitleMock: vi.fn(),
  clearSelectedPipelineJobMock: vi.fn(),
  saveActiveSessionIdMock: vi.fn(),
  saveSessionJobMappingMock: vi.fn(),
  useMediaQueryMock: vi.fn((_query: string) => false),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  getPipelineJobStatus: getPipelineJobStatusMock,
  createSessionFromPipeline: createSessionFromPipelineMock,
  retryPipelineJob: retryPipelineJobMock,
}));

vi.mock('@/features/adaptive/lib/session-storage', () => ({
  getSelectedPipelineJobId: getSelectedPipelineJobIdMock,
  getSelectedPipelineFilename: getSelectedPipelineFilenameMock,
  getSelectedPipelineTitle: getSelectedPipelineTitleMock,
  clearSelectedPipelineJob: clearSelectedPipelineJobMock,
  saveActiveSessionId: saveActiveSessionIdMock,
  saveSessionJobMapping: saveSessionJobMappingMock,
}));

// The shared error keys (`errors.api.*`) come from the root translator; stable like next-intl's.
const rootTranslate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => rootTranslate, useLocale: () => 'vi' }));

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => useMediaQueryMock(query),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

import { trackAdaptivePipelineJob } from '@/features/adaptive/lib/pipeline-analytics';
import { stepFromProgress, useProcessingState } from './use-processing-state';

const t: TranslateFn = ((key: string, values?: Record<string, unknown>) => {
  if (!values) return key;
  return `${key}:${JSON.stringify(values)}`;
}) as TranslateFn;

const JOB_ID = 'job-123';

function createJob(overrides: Partial<PipelineJobStatus> = {}): PipelineJobStatus {
  return {
    job_id: JOB_ID,
    filename: 'notes.pdf',
    subject_id: 'subject-1',
    status: 'extracting',
    current_step: '',
    progress: 0.42,
    total_chunks: 0,
    page_batch_size: 10,
    batch_count: 0,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: 0,
    concepts_after_merge: 0,
    relations_accepted: 0,
    relations_llm_verified: 0,
    relations_deterministic_unverified: 0,
    retry_count: 0,
    retryable: false,
    is_terminal: false,
    is_delayed: false,
    created_at: 0,
    updated_at: 0,
    heartbeat_at: 0,
    retry_after_seconds: 2,
    ...overrides,
  } as PipelineJobStatus;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flushMicrotasks();
}

function renderProcessingState() {
  return renderHook(() => useProcessingState(t));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.clearAllMocks();
  getSelectedPipelineJobIdMock.mockReturnValue(JOB_ID);
  getSelectedPipelineFilenameMock.mockImplementation((fallback: string) => fallback);
  getSelectedPipelineTitleMock.mockImplementation((fallback: string) => fallback);
  useMediaQueryMock.mockReturnValue(false);
  getPipelineJobStatusMock.mockReset();
  createSessionFromPipelineMock.mockReset();
  window.localStorage.clear();
  window.dataLayer = [];
});

function analyticsEvents(name: string) {
  return (window.dataLayer ?? []).filter(
    (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === name,
  ) as [string, string, Record<string, unknown>][];
}

function trackJobWithConsent() {
  window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
  trackAdaptivePipelineJob(JOB_ID, 'journey-1');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useProcessingState', () => {
  describe('initial surface and media', () => {
    it('exposes steps, starting label, filename fallback, and media query result', async () => {
      getSelectedPipelineFilenameMock.mockReturnValue('lecture.pdf');
      useMediaQueryMock.mockReturnValue(true);
      const pending = deferred<PipelineJobStatus>();
      getPipelineJobStatusMock.mockReturnValueOnce(pending.promise);

      const { result } = renderProcessingState();

      expect(useMediaQueryMock).toHaveBeenCalledWith(MEDIA_MIN_LG);
      expect(result.current.showGraphPanel).toBe(true);
      expect(result.current.filename).toBe('lecture.pdf');
      expect(getSelectedPipelineFilenameMock).toHaveBeenCalledWith('processing.defaultFilename');
      expect(result.current.statusLabel).toBe('processing.status.starting');
      expect(result.current.steps).toEqual([
        { id: 1, label: 'processing.steps.readingPdf' },
        { id: 2, label: 'processing.steps.extractingConcepts' },
        { id: 3, label: 'processing.steps.computingEmbeddings' },
        { id: 4, label: 'processing.steps.mergingAndRanking' },
        { id: 5, label: 'processing.steps.verifyingAndBuildingGraph' },
        { id: 6, label: 'processing.steps.finalizingSession' },
      ]);
      expect(result.current).toMatchObject({
        creatingSession: false,
        currentStep: 0,
        error: null,
        notice: null,
        partialGraph: null,
        progress: 0,
        stats: null,
      });
      expect(typeof result.current.handleErrorAction).toBe('function');

      pending.resolve(createJob({ status: 'pending', progress: 0 }));
      await flushMicrotasks();
      expect(result.current.statusLabel).toBe('processing.status.waitingToStart');
    });
  });

  describe('missing job id', () => {
    it('sets a non-retryable job-not-found error via microtask', async () => {
      getSelectedPipelineJobIdMock.mockReturnValue(null);

      const { result } = renderProcessingState();
      expect(result.current.error).toBeNull();

      await flushMicrotasks();

      expect(result.current.error).toEqual({
        message: 'processing.errors.jobNotFound',
        retryable: false,
        code: 'pipeline_job_missing',
        action: 'upload',
      });
      expect(getPipelineJobStatusMock).not.toHaveBeenCalled();
    });

    it('does not set the missing-job error after unmount cancels the microtask', async () => {
      getSelectedPipelineJobIdMock.mockReturnValue(null);

      const { result, unmount } = renderProcessingState();
      unmount();
      await flushMicrotasks();

      expect(result.current.error).toBeNull();
    });
  });

  describe('status progression while polling', () => {
    it.each([
      ['pending', 0, 'processing.status.waitingToStart'],
      ['queued', 0, 'processing.status.queuedForProcessing'],
      ['loading', 1, 'processing.status.readingDocument'],
      ['chunking', 1, 'processing.status.splittingChunks'],
      ['extracting', 2, 'processing.status.extractingConceptsWithAI'],
      ['embedding', 3, 'processing.status.computingEmbeddings'],
      ['merging', 4, 'processing.status.mergingDuplicateConcepts'],
      ['ranking', 4, 'processing.status.rankingPrerequisites'],
      ['verifying', 5, 'processing.status.verifyingRelationsWithAI'],
      ['building_graph', 5, 'processing.status.buildingKnowledgeGraph'],
      ['optimizing', 6, 'processing.status.optimizingDAG'],
    ] as const)('maps status %s to step and label', async (status, step, labelKey) => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: status as PipelineStatus,
          progress: 0.25,
          current_step: '',
          retry_after_seconds: 2,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.currentStep).toBe(step);
      expect(result.current.progress).toBe(25);
      expect(result.current.statusLabel).toBe(labelKey);
      expect(getPipelineJobStatusMock).toHaveBeenCalledWith(JOB_ID);
    });

    it('prefers job.current_step over the mapped status label', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'extracting',
          current_step: 'Custom step text',
          progress: 0.5,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.statusLabel).toBe('Custom step text');
      expect(result.current.progress).toBe(50);
      expect(result.current.currentStep).toBe(2);
    });

    it('schedules the next poll using retry_after_seconds with deterministic jitter', async () => {
      getPipelineJobStatusMock
        .mockResolvedValueOnce(
          createJob({
            status: 'loading',
            progress: 0.1,
            retry_after_seconds: 3,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'extracting',
            progress: 0.4,
            retry_after_seconds: 2,
          }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.currentStep).toBe(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);

      await advance(2999);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);

      await advance(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      expect(result.current.currentStep).toBe(2);
      expect(result.current.progress).toBe(40);
    });

    it('uses a 2s default when retry_after_seconds is nullish and clamps zero to 1s', async () => {
      const jobWithoutRetryDelay = createJob({
        status: 'pending',
        progress: 0,
      });
      Reflect.deleteProperty(jobWithoutRetryDelay, 'retry_after_seconds');

      getPipelineJobStatusMock
        .mockResolvedValueOnce(jobWithoutRetryDelay)
        .mockResolvedValueOnce(
          createJob({
            status: 'queued',
            progress: 0.05,
            retry_after_seconds: 0,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'loading',
            progress: 0.1,
            retry_after_seconds: 2,
          }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(result.current.currentStep).toBe(0);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);

      await advance(2000);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      expect(result.current.statusLabel).toBe('processing.status.queuedForProcessing');

      await advance(1000);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(3);
      expect(result.current.currentStep).toBe(1);
    });
  });

  describe('stats, graph, and pipeline notices', () => {
    it('ignores stats when concepts_extracted is zero and sets partial graph when present', async () => {
      const partialGraph = {
        nodes: [{ id: 'n1', name: 'Concept A' }],
        edges: [{ source: 'n1', target: 'n2' }],
      };
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'verifying',
          progress: 0.8,
          concepts_extracted: 0,
          partial_graph: partialGraph,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.stats).toBeNull();
      expect(result.current.partialGraph).toEqual(partialGraph);
    });

    it('updates stats and skips identical subsequent stats payloads', async () => {
      getPipelineJobStatusMock
        .mockResolvedValueOnce(
          createJob({
            status: 'merging',
            progress: 0.6,
            concepts_extracted: 10,
            concepts_after_merge: 8,
            relations_accepted: 3,
            relations_llm_verified: 3,
            relations_deterministic_unverified: 0,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'ranking',
            progress: 0.65,
            concepts_extracted: 10,
            concepts_after_merge: 8,
            relations_accepted: 3,
            relations_llm_verified: 3,
            relations_deterministic_unverified: 0,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'verifying',
            progress: 0.7,
            concepts_extracted: 12,
            concepts_after_merge: 9,
            relations_accepted: 4,
            relations_llm_verified: 4,
            relations_deterministic_unverified: 0,
            retry_after_seconds: 1,
          }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      const firstStats = result.current.stats;
      expect(firstStats).toEqual({
        concepts_extracted: 10,
        concepts_after_merge: 8,
        relations_accepted: 3,
      });

      await advance(1000);
      expect(result.current.stats).toBe(firstStats);

      await advance(1000);
      expect(result.current.stats).toEqual({
        concepts_extracted: 12,
        concepts_after_merge: 9,
        relations_accepted: 4,
      });
    });

    it('sets partial-success notice, delayed notice, then clears notice', async () => {
      getPipelineJobStatusMock
        .mockResolvedValueOnce(
          createJob({
            status: 'extracting',
            partial_success: true,
            failed_batch_count: 2,
            batch_count: 5,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'embedding',
            is_delayed: true,
            partial_success: false,
            failed_batch_count: 0,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(
          createJob({
            status: 'merging',
            is_delayed: false,
            partial_success: false,
            failed_batch_count: 0,
            retry_after_seconds: 1,
          }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(result.current.notice).toBe(
        'processing.notices.partialSuccess:{"failed":2,"total":5}',
      );

      await advance(1000);
      expect(result.current.notice).toBe('processing.notices.processingTakingLonger');

      await advance(1000);
      expect(result.current.notice).toBeNull();
    });

    it('uses failed batch count as total when batch_count is lower', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'extracting',
          partial_success: true,
          failed_batch_count: 4,
          batch_count: 1,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.notice).toBe(
        'processing.notices.partialSuccess:{"failed":4,"total":4}',
      );
    });
  });

  describe('completed job → session creation and navigation', () => {
    it('creates a session, persists mapping, toasts success, and navigates after 800ms', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'completed',
          progress: 1,
          current_step: '',
          concepts_extracted: 5,
          concepts_after_merge: 4,
          relations_accepted: 2,
          relations_llm_verified: 2,
          relations_deterministic_unverified: 0,
        }),
      );
      createSessionFromPipelineMock.mockResolvedValue({ session_id: 'session-9' });

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);
      expect(createSessionFromPipelineMock).toHaveBeenCalledWith(JOB_ID, 50);
      expect(saveActiveSessionIdMock).toHaveBeenCalledWith('session-9');
      expect(saveSessionJobMappingMock).toHaveBeenCalledWith('session-9', JOB_ID, {
        filename: 'processing.defaultFilename',
        subjectName: 'processing.defaultFilename',
      });
      expect(clearSelectedPipelineJobMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('processing.status.completed');
      expect(result.current.creatingSession).toBe(true);
      expect(result.current.currentStep).toBe(6);
      expect(result.current.progress).toBe(100);
      expect(result.current.statusLabel).toBe('processing.status.completed');
      expect(pushMock).not.toHaveBeenCalled();

      await advance(799);
      expect(pushMock).not.toHaveBeenCalled();

      await advance(1);
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.subject('session-9'));
    });

    it('clears the navigation timer on unmount so push does not fire', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockResolvedValue({ session_id: 'session-abort' });

      const { unmount } = renderProcessingState();
      await flushMicrotasks();
      unmount();

      await advance(1000);
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('retries create-session for pipeline_not_completed with create-session notice and backoff', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'not ready',
            code: 'pipeline_not_completed',
            status: 409,
            retryable: true,
          }),
        )
        .mockResolvedValueOnce({ session_id: 'session-ready' });

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.creatingSession).toBe(false);
      expect(result.current.notice).toBe('processing.notices.retryingCreateSession');
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('processing.notices.retryingCreateSession');
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);

      // attempt 1 → backoff 2000ms
      await advance(2000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(2);
      expect(saveActiveSessionIdMock).toHaveBeenCalledWith('session-ready');
      expect(result.current.creatingSession).toBe(true);
    });

    it('uses sessionSetupUnconfirmed notice for other retryable create-session errors', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'upstream',
            code: 'service_unavailable',
            status: 503,
            retryable: true,
          }),
        )
        .mockResolvedValueOnce({ session_id: 'session-2' });

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.notice).toBe('processing.notices.sessionSetupUnconfirmed');
      expect(toastErrorMock).toHaveBeenCalledWith('processing.notices.sessionSetupUnconfirmed');
    });

    it('stops after CREATE_SESSION_MAX_RETRIES with a retryable dashboard error', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'not ready',
          code: 'pipeline_not_completed',
          status: 409,
          retryable: true,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(result.current.error).toBeNull();
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);

      // Backoff after attempts 1..4: 2s, 4s, 8s, 10s → 5th call is terminal
      await advance(2_000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();

      await advance(4_000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(3);
      expect(result.current.error).toBeNull();

      await advance(8_000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(4);
      expect(result.current.error).toBeNull();

      const toastsBeforeLastAttempt = toastErrorMock.mock.calls.length;
      await advance(10_000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(5);
      // RIN-809: the last attempt shows the failure card; no "retrying" toast next to it.
      expect(toastErrorMock).toHaveBeenCalledTimes(toastsBeforeLastAttempt);
      expect(result.current.notice).toBeNull();
      expect(result.current.error).toEqual({
        message: 'processing.errors.sessionSetupUnconfirmed',
        retryable: true,
        code: 'pipeline_not_completed',
        action: 'dashboard',
      });
      expect(result.current.creatingSession).toBe(false);
    });

    it('uses API error code when max retries exhaust a retryable AdaptiveApiError', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'retry me',
          code: 'temporary_glitch',
          retryable: true,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      await advance(2_000);
      await advance(4_000);
      await advance(8_000);
      await advance(10_000);

      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(5);
      expect(result.current.error).toEqual({
        message: 'processing.errors.sessionSetupUnconfirmed',
        retryable: true,
        code: 'temporary_glitch',
        action: 'dashboard',
      });
    });

    it('maps non-retryable create-session failures to friendly dashboard errors', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'auth',
          code: 'unauthorized',
          status: 401,
          retryable: false,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.error).toEqual({
        message: 'processing.errors.unauthorized',
        retryable: false,
        code: 'unauthorized',
        action: 'dashboard',
      });
      // RIN-809: the failure card is the only message.
      expect(toastErrorMock).not.toHaveBeenCalled();
      expect(result.current.creatingSession).toBe(false);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('terminal failed and cancelled jobs', () => {
    it.each([
      {
        name: 'pipeline_timeout',
        job: {
          status: 'failed' as const,
          error_code: 'pipeline_timeout',
          retryable: true,
        },
        expected: {
          message: 'processing.errors.pipelineTimeout',
          retryable: true,
          code: 'pipeline_timeout',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'pipeline_cancelled code',
        job: {
          status: 'failed' as const,
          error_code: 'pipeline_cancelled',
          retryable: true,
        },
        expected: {
          message: 'processing.errors.pipelineCancelled',
          retryable: true,
          code: 'pipeline_cancelled',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'cancelled status without code',
        job: {
          status: 'cancelled' as const,
          error_code: null,
          retryable: true,
        },
        expected: {
          message: 'processing.errors.pipelineCancelled',
          retryable: true,
          code: 'pipeline_cancelled',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'pipeline_unavailable',
        job: {
          status: 'failed' as const,
          error_code: 'pipeline_unavailable',
          retryable: true,
        },
        expected: {
          message: 'processing.errors.pipelineUnavailable',
          retryable: true,
          code: 'pipeline_unavailable',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        // RIN-754: the server's user_message is never shown; unknown codes get the generic copy.
        name: 'user_message with an unknown code',
        job: {
          status: 'failed' as const,
          error_code: 'custom_code',
          user_message: '  Backend said no  ',
          retryable: false,
        },
        expected: {
          message:
            'processing.errors.failedAtStepFinal:{"step":"processing.steps.extractingConcepts"}',
          retryable: false,
          code: 'custom_code',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'pipeline_stalled code key',
        job: {
          status: 'failed' as const,
          error_code: 'pipeline_stalled',
          user_message: 'Worker heartbeat lost on node-7',
          retryable: true,
        },
        expected: {
          message: 'errors.api.codes.pipelineStalled',
          retryable: true,
          code: 'pipeline_stalled',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        // RIN-1004: an upload-time code never explains a failure later in processing.
        name: 'quota_exceeded code',
        job: {
          status: 'failed' as const,
          error_code: 'quota_exceeded',
          user_message: 'Usage quota exceeded',
          retryable: false,
        },
        expected: {
          message:
            'processing.errors.failedAtStepFinal:{"step":"processing.steps.extractingConcepts"}',
          retryable: false,
          code: 'quota_exceeded',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'unsupported_media_type code',
        job: {
          status: 'failed' as const,
          error_code: 'unsupported_media_type',
          user_message: 'application/x-msdownload rejected',
          retryable: false,
        },
        expected: {
          message:
            'processing.errors.failedAtStepFinal:{"step":"processing.steps.extractingConcepts"}',
          retryable: false,
          code: 'unsupported_media_type',
          action: 'upload' as const,
        },
        notice: null,
      },
      {
        name: 'generic pipeline failed',
        job: {
          status: 'failed' as const,
          error_code: null,
          user_message: '   ',
          retryable: false,
        },
        expected: {
          message:
            'processing.errors.failedAtStepFinal:{"step":"processing.steps.extractingConcepts"}',
          retryable: false,
          code: null,
          action: 'upload' as const,
        },
        notice: null,
      },
    ])('handles $name', async ({ job, expected, notice }) => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ progress: 0.3, ...job }));

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.error).toEqual(expected);
      expect(result.current.notice).toBe(notice);
      // RIN-809: the failure card is the only message.
      expect(toastErrorMock).not.toHaveBeenCalled();
      expect(result.current.currentStep).toBe(-1);
      // progress 0.3 is inside "extracting concepts" (step 2).
      expect(result.current.failedStep).toBe(2);
      expect(result.current.canRetry).toBe(expected.retryable);
    });

    it.each([
      [0, null],
      [0.05, 1],
      [0.3, 2],
      [0.35, 3],
      [0.65, 4],
      [0.8, 5],
      [0.95, 6],
    ])('maps progress %s to step %s', (progress, step) => {
      expect(stepFromProgress(progress)).toBe(step);
    });

    it('marks the last step seen while polling and names it in the message', async () => {
      getPipelineJobStatusMock
        .mockResolvedValueOnce(createJob({ status: 'optimizing', progress: 0.91 }))
        .mockResolvedValueOnce(
          createJob({
            status: 'failed',
            progress: 0.3,
            error_code: 'pipeline_failed',
            retryable: true,
          }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(result.current.currentStep).toBe(6);
      await advance(2_000);

      expect(result.current.failedStep).toBe(6);
      expect(result.current.error?.message).toBe(
        'processing.errors.failedAtStep:{"step":"processing.steps.finalizingSession"}',
      );
    });

    it('falls back to the generic copy when the failed step is unknown', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({ status: 'failed', progress: 0, error_code: null, retryable: false }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.failedStep).toBeNull();
      expect(result.current.error?.message).toBe('processing.errors.pipelineFailed');
    });
  });

  describe('retry and back to library (RIN-1004)', () => {
    it('re-runs the failed job in place and polls it again', async () => {
      getPipelineJobStatusMock.mockResolvedValueOnce(
        createJob({
          status: 'failed',
          progress: 0.5,
          error_code: 'pipeline_timeout',
          retryable: true,
        }),
      );
      retryPipelineJobMock.mockResolvedValue({ job_id: JOB_ID, status: 'queued' });

      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(result.current.canRetry).toBe(true);

      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'loading', progress: 0.05 }));
      await act(async () => {
        await result.current.handleRetry();
      });
      await flushMicrotasks();

      expect(retryPipelineJobMock).toHaveBeenCalledWith(JOB_ID);
      expect(result.current.error).toBeNull();
      expect(result.current.failedStep).toBeNull();
      expect(result.current.currentStep).toBe(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('keeps the failure card and toasts when the retry is refused', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'failed',
          progress: 0.5,
          error_code: 'pipeline_timeout',
          retryable: true,
        }),
      );
      retryPipelineJobMock.mockRejectedValue(
        new AdaptiveApiError({ message: 'busy', code: 'conflict', retryable: false }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      await act(async () => {
        await result.current.handleRetry();
      });

      expect(result.current.error?.code).toBe('pipeline_timeout');
      expect(result.current.retrying).toBe(false);
      expect(toastErrorMock).toHaveBeenCalledOnce();
    });

    it('goes back to the library without clearing the selected job', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({ status: 'failed', progress: 0.5, error_code: null, retryable: false }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();
      act(() => {
        result.current.handleBackToLibrary();
      });

      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
      expect(clearSelectedPipelineJobMock).not.toHaveBeenCalled();
    });
  });

  describe('polling errors, backoff, and toast throttle', () => {
    it('retries service-unavailable poll errors with backend-slow notice and exponential backoff', async () => {
      getPipelineJobStatusMock
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'down',
            code: 'service_unavailable',
            status: 503,
            retryable: true,
          }),
        )
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'down',
            code: 'upstream_timeout',
            status: 504,
            retryable: true,
          }),
        )
        .mockResolvedValueOnce(
          createJob({ status: 'loading', progress: 0.2, retry_after_seconds: 2 }),
        );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.notice).toBe('processing.notices.backendSlowRetrying');
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);

      // first retry delay starts at BASE*2 = 4000 after first failure (doubled from 2000)
      await advance(3999);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      expect(result.current.notice).toBe('processing.notices.backendSlowRetrying');

      // second failure doubles to 8000
      await advance(8000);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(3);
      expect(result.current.currentStep).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('uses connectionInterrupted notice for aborted poll errors', async () => {
      getPipelineJobStatusMock
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'aborted',
            code: 'request_aborted',
            status: 0,
            retryable: true,
          }),
        )
        .mockResolvedValueOnce(createJob({ status: 'pending', progress: 0 }));

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.notice).toBe('processing.notices.connectionInterrupted');
      await advance(4000);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
    });

    it('uses generic connectionInterrupted notice for other retryable poll errors', async () => {
      getPipelineJobStatusMock.mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'other',
          code: 'temporary',
          retryable: true,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.notice).toBe('processing.notices.connectionInterrupted');
    });

    it('maps non-retryable poll failures via friendly processing errors', async () => {
      getPipelineJobStatusMock.mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'missing',
          code: 'not_found',
          status: 404,
          retryable: false,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(result.current.error).toEqual({
        message: 'processing.errors.jobNotFound',
        retryable: false,
        code: 'not_found',
        action: 'upload',
      });
      expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it.each([
      {
        code: 'conflict',
        messageKey: 'processing.errors.conflict',
        retryable: false,
      },
      {
        code: 'service_unavailable',
        messageKey: 'processing.errors.serviceUnavailable',
        // non-retryable AdaptiveApiError hits friendly mapper (retryable flag false)
        retryable: false,
      },
      {
        code: 'request_aborted',
        messageKey: 'processing.errors.connectionInterrupted',
        retryable: false,
      },
      {
        code: 'pipeline_not_completed',
        messageKey: 'processing.errors.sessionNotReady',
        retryable: false,
      },
    ] as const)(
      'maps AdaptiveApiError code $code during non-retryable poll failure',
      async ({ code, messageKey }) => {
        getPipelineJobStatusMock.mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'x',
            code,
            retryable: false,
          }),
        );

        const { result } = renderProcessingState();
        await flushMicrotasks();

        expect(result.current.error).toEqual({
          message: messageKey,
          retryable:
            code === 'service_unavailable' ||
            code === 'request_aborted' ||
            code === 'pipeline_not_completed'
              ? true
              : false,
          code,
          action: code === 'pipeline_not_completed' ? 'dashboard' : 'upload',
        });
      },
    );

    it('never shows a plain Error message; non-Error values get the generic copy too', async () => {
      getPipelineJobStatusMock
        .mockRejectedValueOnce(new Error('plain boom'))
        .mockRejectedValueOnce('string-failure');

      const first = renderProcessingState();
      await flushMicrotasks();
      expect(first.result.current.error).toEqual({
        message: 'processing.errors.generic',
        retryable: false,
        code: null,
        action: 'upload',
      });
      first.unmount();

      // second mount for non-Error path
      getSelectedPipelineJobIdMock.mockReturnValue(JOB_ID);
      const second = renderProcessingState();
      await flushMicrotasks();
      expect(second.result.current.error).toEqual({
        message: 'processing.errors.generic',
        retryable: false,
        code: null,
        action: 'upload',
      });
      second.unmount();
    });

    it.each([
      { code: 'quota_exceeded', status: 429, messageKey: 'errors.api.codes.quotaExceeded' },
      { code: 'pipeline_stalled', status: 409, messageKey: 'errors.api.codes.pipelineStalled' },
      { code: 'forbidden', status: 403, messageKey: 'errors.api.forbidden' },
    ])(
      'uses the $code key for a non-retryable $status poll failure, not its message',
      async ({ code, status, messageKey }) => {
        getPipelineJobStatusMock.mockRejectedValueOnce(
          new AdaptiveApiError({ message: 'raw server text', code, status }),
        );

        const { result } = renderProcessingState();
        await flushMicrotasks();

        expect(result.current.error).toEqual({
          message: messageKey,
          retryable: false,
          code,
          action: 'upload',
        });
        expect(toastErrorMock).not.toHaveBeenCalled();
      },
    );

    it('throttles identical toast messages within the 4s window and allows later ones', async () => {
      getPipelineJobStatusMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'missing',
          code: 'not_found',
          retryable: false,
        }),
      );

      const first = renderProcessingState();
      await flushMicrotasks();
      // A terminal failure shows the card only (RIN-809).
      expect(toastErrorMock).not.toHaveBeenCalled();
      first.unmount();

      // remount quickly with same terminal message → still throttled via module-level? No —
      // throttle is per-hook instance (ref). New instance has empty lastToastRef.
      // Instead, force two toasts in one instance via create-session retry + same notice.
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'not ready',
          code: 'pipeline_not_completed',
          retryable: true,
        }),
      );

      toastErrorMock.mockClear();
      const { result } = renderProcessingState();
      await flushMicrotasks();
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('processing.notices.retryingCreateSession');

      // next retry within throttle window reuses same message
      await advance(2000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(2);
      expect(toastErrorMock).toHaveBeenCalledTimes(1);

      // advance past throttle window (4s from last toast); next failure should toast again
      await advance(10_000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(3);
      expect(toastErrorMock).toHaveBeenCalledTimes(2);
      expect(result.current.notice).toBe('processing.notices.retryingCreateSession');
    });

    it('never toasts a failure that the failure card already shows (RIN-809)', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValueOnce(
        new AdaptiveApiError({ message: 'auth', code: 'unauthorized', retryable: false }),
      );

      const first = renderProcessingState();
      await flushMicrotasks();
      expect(first.result.current.error?.message).toBe('processing.errors.unauthorized');
      first.unmount();

      getPipelineJobStatusMock.mockReset();
      getPipelineJobStatusMock.mockRejectedValue(
        new AdaptiveApiError({ message: 'missing', code: 'conflict', retryable: false }),
      );

      const second = renderProcessingState();
      await flushMicrotasks();
      expect(second.result.current.error?.message).toBe('processing.errors.conflict');
      second.unmount();

      getPipelineJobStatusMock.mockReset();
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({ status: 'failed', error_code: 'pipeline_stalled', retryable: true }),
      );

      const third = renderProcessingState();
      await flushMicrotasks();
      expect(third.result.current.error).not.toBeNull();
      third.unmount();

      expect(toastErrorMock).not.toHaveBeenCalled();
    });
  });

  describe('handleErrorAction navigation', () => {
    it('navigates to dashboard for dashboard-action errors', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'auth',
          code: 'unauthorized',
          retryable: false,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      act(() => {
        result.current.handleErrorAction();
      });

      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
      expect(clearSelectedPipelineJobMock).not.toHaveBeenCalled();
    });

    it('clears the selected job and navigates to upload for upload-action errors', async () => {
      getPipelineJobStatusMock.mockRejectedValue(
        new AdaptiveApiError({
          message: 'missing',
          code: 'not_found',
          retryable: false,
        }),
      );

      const { result } = renderProcessingState();
      await flushMicrotasks();

      act(() => {
        result.current.handleErrorAction();
      });

      expect(clearSelectedPipelineJobMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.upload);
      expect(result.current.notice).toBeNull();
    });

    it('defaults to upload navigation when error is still null', async () => {
      const pending = deferred<PipelineJobStatus>();
      getPipelineJobStatusMock.mockReturnValueOnce(pending.promise);

      const { result } = renderProcessingState();
      await flushMicrotasks();

      act(() => {
        result.current.handleErrorAction();
      });

      expect(clearSelectedPipelineJobMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.upload);

      pending.resolve(createJob({ status: 'pending' }));
      await flushMicrotasks();
    });
  });

  describe('cleanup and in-flight guards', () => {
    it('stops the poll loop on unmount and does not continue after cancel', async () => {
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({ status: 'loading', progress: 0.1, retry_after_seconds: 2 }),
      );

      const { unmount } = renderProcessingState();
      await flushMicrotasks();
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);

      unmount();
      await advance(5000);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);
    });

    it('does not start a second create-session while creatingSessionRef is held', async () => {
      const createDeferred = deferred<{ session_id: string }>();
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockReturnValueOnce(createDeferred.promise);

      const { result } = renderProcessingState();
      await flushMicrotasks();

      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);
      expect(result.current.creatingSession).toBe(true);

      // Even if timers fire, in-flight create should keep the loop from re-entering.
      await advance(5000);
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);

      createDeferred.resolve({ session_id: 'session-late' });
      await flushMicrotasks();
      expect(saveActiveSessionIdMock).toHaveBeenCalledWith('session-late');
    });

    it('starts a fresh create-session attempt on a new mount after a prior retry was abandoned', async () => {
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock.mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'not ready',
          code: 'pipeline_not_completed',
          retryable: true,
        }),
      );

      const { unmount } = renderProcessingState();
      await flushMicrotasks();
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);
      unmount();

      createSessionFromPipelineMock.mockReset();
      createSessionFromPipelineMock.mockResolvedValue({ session_id: 'session-new' });
      getPipelineJobStatusMock.mockReset();
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));

      renderProcessingState();
      await flushMicrotasks();
      expect(createSessionFromPipelineMock).toHaveBeenCalledTimes(1);
      expect(createSessionFromPipelineMock).toHaveBeenCalledWith(JOB_ID, 50);
      expect(saveActiveSessionIdMock).toHaveBeenCalledWith('session-new');
    });
  });

  describe('jitter floor', () => {
    it('clamps jittered delay to at least 500ms', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // jitter = 1 - 0.15 = 0.85
      getPipelineJobStatusMock
        .mockResolvedValueOnce(
          createJob({
            status: 'pending',
            progress: 0,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(createJob({ status: 'queued', progress: 0.01 }));

      renderProcessingState();
      await flushMicrotasks();

      // delay = round(1000 * 0.85) = 850
      await advance(849);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
    });

    it('applies positive jitter above the base delay', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(1); // jitter = 1 + 0.15 = 1.15
      getPipelineJobStatusMock
        .mockResolvedValueOnce(
          createJob({
            status: 'pending',
            progress: 0,
            retry_after_seconds: 1,
          }),
        )
        .mockResolvedValueOnce(createJob({ status: 'queued', progress: 0.01 }));

      renderProcessingState();
      await flushMicrotasks();

      // delay = round(1000 * 1.15) = 1150
      await advance(1149);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('terminal analytics events', () => {
    it('emits one pipeline_failed with a slug error code, even after a remount', async () => {
      trackJobWithConsent();
      getPipelineJobStatusMock.mockResolvedValue(
        createJob({
          status: 'failed',
          error_code: 'ocr_failed',
          error_message: 'OCR API request failed for all configured keys.',
          created_at: 1_000,
          updated_at: 1_042,
        }),
      );

      const first = renderProcessingState();
      await flushMicrotasks();
      first.unmount();
      renderProcessingState();
      await flushMicrotasks();

      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      const failed = analyticsEvents('pipeline_failed');
      expect(failed).toHaveLength(1);
      expect(failed[0]?.[2]).toMatchObject({
        path: 'adaptive',
        error_code: 'ocr_failed',
        journey_id: 'journey-1',
        duration_ms: 42_000,
      });
      expect(JSON.stringify(failed[0]?.[2])).not.toMatch(/OCR API|notes\.pdf/);
      expect(analyticsEvents('pipeline_completed')).toHaveLength(0);
    });

    it('emits one pipeline_completed across repeated completed polls', async () => {
      trackJobWithConsent();
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'completed', progress: 1 }));
      createSessionFromPipelineMock
        .mockRejectedValueOnce(
          new AdaptiveApiError({
            message: 'not ready',
            code: 'pipeline_not_completed',
            status: 409,
            retryable: true,
          }),
        )
        .mockResolvedValueOnce({ session_id: 'session-ready' });

      renderProcessingState();
      await flushMicrotasks();
      await advance(2000);

      expect(getPipelineJobStatusMock).toHaveBeenCalledTimes(2);
      const completed = analyticsEvents('pipeline_completed');
      expect(completed).toHaveLength(1);
      expect(completed[0]?.[2]).toMatchObject({ path: 'adaptive', journey_id: 'journey-1' });
      expect(completed[0]?.[2]).not.toHaveProperty('error_code');
    });

    it('stays silent for a job this browser did not submit', async () => {
      window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
      getPipelineJobStatusMock.mockResolvedValue(createJob({ status: 'failed' }));

      renderProcessingState();
      await flushMicrotasks();

      expect(analyticsEvents('pipeline_failed')).toHaveLength(0);
    });
  });
});
