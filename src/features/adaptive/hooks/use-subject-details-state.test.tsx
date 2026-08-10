/** @vitest-environment jsdom */

import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import {
  createSessionFromPipeline,
  getSubjectHistoryDetail,
  getSessionStatus,
  prefetchStartLearningData,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import {
  getJobIdForSession,
  getSubjectTitleForSession,
  saveActiveSessionId,
  saveSessionJobMapping,
} from '@/features/adaptive/lib/session-storage';
import type { SubjectHistoryDetail } from '@/features/adaptive/types/history';
import type { SessionStatus, TranslateFn } from '@/features/adaptive/types/learning';
import { useSubjectDetailsState } from './use-subject-details-state';

const { pushMock, prefetchMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    prefetch: prefetchMock,
  }),
}));

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  createSessionFromPipeline: vi.fn(),
  getSubjectHistoryDetail: vi.fn(),
  getSessionStatus: vi.fn(),
  prefetchStartLearningData: vi.fn(),
}));

vi.mock('@/features/adaptive/lib/session-storage', () => ({
  getJobIdForSession: vi.fn(),
  getSubjectTitleForSession: vi.fn(),
  saveActiveSessionId: vi.fn(),
  saveSessionJobMapping: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const getSessionStatusMock = vi.mocked(getSessionStatus);
const getHistoryMock = vi.mocked(getSubjectHistoryDetail);
const createSessionMock = vi.mocked(createSessionFromPipeline);
const prefetchStartMock = vi.mocked(prefetchStartLearningData);
const getJobIdMock = vi.mocked(getJobIdForSession);
const getTitleMock = vi.mocked(getSubjectTitleForSession);
const saveActiveMock = vi.mocked(saveActiveSessionId);
const saveMappingMock = vi.mocked(saveSessionJobMapping);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);

const t: TranslateFn = ((key: string, values?: Record<string, unknown>) => {
  if (values) {
    return `t:${key}:${JSON.stringify(values)}`;
  }
  return `t:${key}`;
}) as TranslateFn;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createStatus(overrides: Partial<SessionStatus> = {}): SessionStatus {
  return {
    session_id: 'session-1',
    status: 'active',
    step: 1,
    max_steps: 10,
    concepts_visited: 1,
    total_concepts: 5,
    unlocked_concepts: 2,
    locked_concepts: 3,
    mastered_concepts: 0,
    avg_mastery: 0.4,
    progress_percent: 20,
    coverage: 0.2,
    total_correct: 1,
    total_answered: 2,
    accuracy: 0.5,
    exercises: [],
    ...overrides,
  } as SessionStatus;
}

function createHistoryDetail(overrides: Partial<SubjectHistoryDetail> = {}): SubjectHistoryDetail {
  return {
    job_id: 'job-1',
    filename: 'subject.pdf',
    subject_id: 'subject-1',
    status: 'active',
    total_correct: 1,
    total_answered: 2,
    accuracy: 50,
    step: 2,
    max_steps: 5,
    avg_mastery: 0.4,
    unlocked_concepts: 1,
    locked_concepts: 0,
    mastered_concepts: 0,
    progress_percent: 40,
    concept_names: { c0: 'Concept' },
    concept_mastery: [0.8],
    bloom_mastery: [[0.8]],
    exercise_history: [],
    created_at: 1,
    updated_at: 2,
    last_session_id: 'session-1',
    ...overrides,
  } as SubjectHistoryDetail;
}

beforeEach(() => {
  vi.clearAllMocks();
  getJobIdMock.mockReturnValue(null);
  getTitleMock.mockReturnValue('Pipeline Title');
  getSessionStatusMock.mockResolvedValue(createStatus());
  getHistoryMock.mockResolvedValue(createHistoryDetail());
  prefetchStartMock.mockImplementation(async () => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSubjectDetailsState', () => {
  describe('bootstrap', () => {
    it('loads session status, filename, jobId, and clears loading', async () => {
      getJobIdMock.mockReturnValue('job-mapped');
      getSessionStatusMock.mockResolvedValueOnce(
        createStatus({ total_concepts: 7, accuracy: 0.756 }),
      );

      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));

      expect(result.current.loading).toBe(true);
      expect(result.current.activeTab).toBe('graph');
      expect(result.current.filename).toBe('t:defaultLearningPath');
      expect(result.current.summary).toBe('t:subjectDetails.summaryFallback');

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(getSessionStatusMock).toHaveBeenCalledWith('session-1');
      expect(getTitleMock).toHaveBeenCalledWith('session-1', 't:defaultLearningPath');
      expect(result.current.status).toMatchObject({ total_concepts: 7, accuracy: 0.756 });
      expect(result.current.filename).toBe('Pipeline Title');
      expect(result.current.summary).toBe('t:subjectDetails.summary:{"concepts":7,"accuracy":76}');
      // jobId is internal; history path verifies it via getSubjectHistoryDetail
    });

    it('switches to history tab when session is not found', async () => {
      getJobIdMock.mockReturnValue('job-missing');
      getSessionStatusMock.mockRejectedValueOnce(new Error('Session not found'));

      const { result } = renderHook(() => useSubjectDetailsState('session-missing', t));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.activeTab).toBe('history');
      expect(result.current.status).toBeNull();
      expect(result.current.summary).toBe('t:subjectDetails.summaryFallback');
    });

    it('recognizes session_not_found snake_case message', async () => {
      getSessionStatusMock.mockRejectedValueOnce(new Error('session_not_found'));

      const { result } = renderHook(() => useSubjectDetailsState('session-x', t));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.activeTab).toBe('history');
    });

    it('keeps graph tab for non-not-found bootstrap errors', async () => {
      getSessionStatusMock.mockRejectedValueOnce(new Error('network down'));

      const { result } = renderHook(() => useSubjectDetailsState('session-err', t));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.activeTab).toBe('graph');
      expect(result.current.status).toBeNull();
    });

    it('does not dispatch bootstrap patch after unmount', async () => {
      const pending = deferred<SessionStatus>();
      getSessionStatusMock.mockReturnValueOnce(pending.promise);

      const { result, unmount } = renderHook(() => useSubjectDetailsState('session-unmount', t));
      expect(result.current.loading).toBe(true);

      unmount();
      await act(async () => {
        pending.resolve(createStatus({ total_concepts: 99 }));
        await pending.promise;
      });

      // Last observed state before unmount should still be loading/true defaults
      expect(result.current.loading).toBe(true);
      expect(result.current.status).toBeNull();
    });
  });

  describe('routing prefetch', () => {
    it('prefetches dashboard and exercise routes for the session', async () => {
      const { rerender } = renderHook(({ sessionId }) => useSubjectDetailsState(sessionId, t), {
        initialProps: { sessionId: 'session-a' },
      });

      expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
      expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-a'));

      await waitFor(() => expect(getSessionStatusMock).toHaveBeenCalled());

      prefetchMock.mockClear();
      rerender({ sessionId: 'session-b' });
      expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
      expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-b'));
    });
  });

  describe('summary boundaries', () => {
    it('uses fallback when status is null and rounds accuracy*100 for present status', async () => {
      getSessionStatusMock.mockResolvedValueOnce(createStatus({ total_concepts: 0, accuracy: 0 }));
      const { result, rerender } = renderHook(
        ({ sessionId }) => useSubjectDetailsState(sessionId, t),
        { initialProps: { sessionId: 's0' } },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.summary).toBe('t:subjectDetails.summary:{"concepts":0,"accuracy":0}');

      getSessionStatusMock.mockResolvedValueOnce(
        createStatus({ total_concepts: 3, accuracy: 0.994 }),
      );
      rerender({ sessionId: 's1' });
      await waitFor(() =>
        expect(result.current.summary).toBe(
          't:subjectDetails.summary:{"concepts":3,"accuracy":99}',
        ),
      );

      getSessionStatusMock.mockResolvedValueOnce(createStatus({ total_concepts: 1, accuracy: 1 }));
      rerender({ sessionId: 's2' });
      await waitFor(() =>
        expect(result.current.summary).toBe(
          't:subjectDetails.summary:{"concepts":1,"accuracy":100}',
        ),
      );
    });
  });

  describe('history load / dedup / error / unmount', () => {
    it('does not load history when not on history tab or jobId is missing', async () => {
      getJobIdMock.mockReturnValue(null);
      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('history');
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getHistoryMock).not.toHaveBeenCalled();
      expect(result.current.historyLoading).toBe(false);
      expect(result.current.historyDetail).toBeNull();
    });

    it('loads history once for jobId on history tab and sets historyDetail', async () => {
      getJobIdMock.mockReturnValue('job-1');
      const detail = createHistoryDetail({ job_id: 'job-1', filename: 'hist.pdf' });
      getHistoryMock.mockResolvedValueOnce(detail);

      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('mastery');
      });
      expect(getHistoryMock).not.toHaveBeenCalled();

      act(() => {
        result.current.setActiveTab('history');
      });
      expect(result.current.historyLoading).toBe(true);

      await waitFor(() => expect(result.current.historyLoading).toBe(false));
      expect(getHistoryMock).toHaveBeenCalledTimes(1);
      expect(getHistoryMock).toHaveBeenCalledWith('job-1');
      expect(result.current.historyDetail).toEqual(detail);
    });

    it('dedupes concurrent history fetches via promise ref under StrictMode', async () => {
      getJobIdMock.mockReturnValue('job-dedup');
      const pending = deferred<SubjectHistoryDetail>();
      getHistoryMock.mockReturnValue(pending.promise);

      // Bootstrap switches to history when not found so history effect runs on mount.
      getSessionStatusMock.mockRejectedValue(new Error('session not found'));

      const { result } = renderHook(() => useSubjectDetailsState('session-dedup', t), {
        wrapper: StrictMode,
      });

      await waitFor(() => expect(result.current.activeTab).toBe('history'));
      await waitFor(() => expect(getHistoryMock).toHaveBeenCalled());

      // StrictMode double-invokes effects; promise ref should prevent duplicate API calls
      // while the first request is still in flight.
      expect(getHistoryMock).toHaveBeenCalledTimes(1);
      expect(getHistoryMock).toHaveBeenCalledWith('job-dedup');

      await act(async () => {
        pending.resolve(createHistoryDetail({ job_id: 'job-dedup' }));
        await pending.promise;
      });
      await waitFor(() => expect(result.current.historyDetail?.job_id).toBe('job-dedup'));
      expect(result.current.historyLoading).toBe(false);
    });

    it('swallows history errors and clears historyLoading', async () => {
      getJobIdMock.mockReturnValue('job-err');
      getHistoryMock.mockRejectedValueOnce(new Error('not persisted'));

      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('history');
      });
      await waitFor(() => expect(result.current.historyLoading).toBe(false));
      expect(result.current.historyDetail).toBeNull();
    });

    it('does not apply history detail after unmount mid-load', async () => {
      getJobIdMock.mockReturnValue('job-um');
      const pending = deferred<SubjectHistoryDetail>();
      getHistoryMock.mockReturnValueOnce(pending.promise);

      const { result, unmount } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('history');
      });
      expect(result.current.historyLoading).toBe(true);

      unmount();
      await act(async () => {
        pending.resolve(createHistoryDetail({ job_id: 'job-um' }));
        await pending.promise;
      });

      expect(result.current.historyDetail).toBeNull();
    });

    it('skips history reload when historyDetail is already present', async () => {
      getJobIdMock.mockReturnValue('job-once');
      getHistoryMock.mockResolvedValueOnce(createHistoryDetail());

      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('history');
      });
      await waitFor(() => expect(result.current.historyDetail).not.toBeNull());
      expect(getHistoryMock).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.setActiveTab('graph');
      });
      act(() => {
        result.current.setActiveTab('history');
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getHistoryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setActiveTab and back navigation', () => {
    it('updates activeTab via setActiveTab and navigates home on back', async () => {
      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setActiveTab('mastery');
      });
      expect(result.current.activeTab).toBe('mastery');

      act(() => {
        result.current.setActiveTab('graph');
      });
      expect(result.current.activeTab).toBe('graph');

      act(() => {
        result.current.handleBackToDashboard();
      });
      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
    });
  });

  describe('handlePrefetchStartLearning', () => {
    it('prefetches once and ignores subsequent calls', async () => {
      const { result } = renderHook(() => useSubjectDetailsState('session-pf', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.handlePrefetchStartLearning();
      });
      expect(prefetchStartMock).toHaveBeenCalledTimes(1);
      expect(prefetchStartMock).toHaveBeenCalledWith('session-pf');

      act(() => {
        result.current.handlePrefetchStartLearning();
        result.current.handlePrefetchStartLearning();
      });
      expect(prefetchStartMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleStartLearning', () => {
    it('routes to existing session exercise when status is present (even with jobId)', async () => {
      getJobIdMock.mockReturnValue('job-1');
      getSessionStatusMock.mockResolvedValueOnce(createStatus());

      const { result } = renderHook(() => useSubjectDetailsState('session-1', t));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.status).not.toBeNull();

      act(() => {
        result.current.handleStartLearning();
      });

      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-1'));
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(result.current.startingSession).toBe(false);
    });

    it('routes to exercise when status is null and jobId is missing', async () => {
      getJobIdMock.mockReturnValue(null);
      getSessionStatusMock.mockRejectedValueOnce(new Error('network'));

      const { result } = renderHook(() => useSubjectDetailsState('session-no-job', t));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.status).toBeNull();

      act(() => {
        result.current.handleStartLearning();
      });

      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-no-job'));
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('creates a new session from pipeline when status is null and jobId exists', async () => {
      getJobIdMock.mockReturnValue('job-create');
      getSessionStatusMock.mockRejectedValueOnce(new Error('session not found'));
      createSessionMock.mockResolvedValueOnce({
        session_id: 'session-created',
        n_concepts: 4,
        source: 'new_session',
        job_id: 'job-create',
        status: 'active',
      });

      const { result } = renderHook(() => useSubjectDetailsState('session-old', t));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.status).toBeNull();

      await act(async () => {
        result.current.handleStartLearning();
      });

      await waitFor(() => expect(createSessionMock).toHaveBeenCalledWith('job-create', 50));
      await waitFor(() =>
        expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-created')),
      );

      expect(saveActiveMock).toHaveBeenCalledWith('session-created');
      expect(saveMappingMock).toHaveBeenCalledWith('session-created', 'job-create', {
        filename: 'Pipeline Title',
        subjectName: 'Pipeline Title',
      });
      expect(toastSuccessMock).toHaveBeenCalledWith('t:processing.creatingSession');
      expect(result.current.startingSession).toBe(false);
      expect(result.current.sessionNotice).toBeNull();
    });

    it('sets startingSession true during create and clears it in finally on success', async () => {
      getJobIdMock.mockReturnValue('job-slow');
      getSessionStatusMock.mockRejectedValueOnce(new Error('session not found'));
      const pending = deferred<Awaited<ReturnType<typeof createSessionFromPipeline>>>();
      createSessionMock.mockReturnValueOnce(pending.promise);

      const { result } = renderHook(() => useSubjectDetailsState('session-slow', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.handleStartLearning();
      });
      expect(result.current.startingSession).toBe(true);
      expect(result.current.sessionNotice).toBeNull();

      await act(async () => {
        pending.resolve({
          session_id: 'session-done',
          n_concepts: 1,
          source: 'existing_session',
          job_id: 'job-slow',
          status: 'active',
        });
        await pending.promise;
      });

      await waitFor(() => expect(result.current.startingSession).toBe(false));
      expect(saveActiveMock).toHaveBeenCalledWith('session-done');
      expect(saveMappingMock).toHaveBeenCalledWith('session-done', 'job-slow', {
        filename: 'Pipeline Title',
        subjectName: 'Pipeline Title',
      });
    });

    it('on create error: sets sessionNotice, error toast, logs, and clears startingSession', async () => {
      getJobIdMock.mockReturnValue('job-fail');
      getSessionStatusMock.mockRejectedValueOnce(new Error('session not found'));
      createSessionMock.mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'unavailable',
          code: 'service_unavailable',
          status: 503,
          retryable: true,
        }),
      );

      const { result } = renderHook(() => useSubjectDetailsState('session-fail', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        result.current.handleStartLearning();
      });

      await waitFor(() => expect(result.current.startingSession).toBe(false));
      expect(result.current.sessionNotice).toBe('t:subjectDetails.sessionUnavailable');
      expect(toastErrorMock).toHaveBeenCalledWith('t:subjectDetails.sessionUnavailable');
      expect(console.error).toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('/exercise/session-'));
      expect(saveActiveMock).not.toHaveBeenCalled();
    });

    it('clears prior sessionNotice when start is retried', async () => {
      getJobIdMock.mockReturnValue('job-retry');
      getSessionStatusMock.mockRejectedValueOnce(new Error('session not found'));
      createSessionMock.mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce({
        session_id: 'session-ok',
        n_concepts: 1,
        source: 'new_session',
        job_id: 'job-retry',
        status: 'active',
      });

      const { result } = renderHook(() => useSubjectDetailsState('session-retry', t));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        result.current.handleStartLearning();
      });
      await waitFor(() =>
        expect(result.current.sessionNotice).toBe('t:subjectDetails.sessionOpenFailed'),
      );

      await act(async () => {
        result.current.handleStartLearning();
      });
      await waitFor(() => expect(result.current.sessionNotice).toBeNull());
      expect(toastSuccessMock).toHaveBeenCalledWith('t:processing.creatingSession');
    });
  });
});
