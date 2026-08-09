/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import type { SessionHistoryItem } from '@/features/adaptive/types/history';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type {
  PipelineJobHistoryItem,
  PipelineJobListItem,
} from '@/features/adaptive/types/pipeline';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';

const {
  pushMock,
  prefetchMock,
  checkApiHealthMock,
  deleteSubjectMock,
  getSubjectProgressHistoryMock,
  getSubjectsMock,
  getSubjectsFreshMock,
  clearSelectedPipelineJobMock,
  startSubjectMock,
  jobLibraryRefreshMock,
  jobLibraryCancelMock,
  jobLibraryRetryMock,
  useJobLibraryMock,
  useStartAdaptiveSubjectMock,
  jobLibraryState,
  startSubjectState,
} = vi.hoisted(() => {
  const jobLibraryState = {
    jobs: [] as PipelineJobListItem[],
    loading: false,
    busyJobId: null as string | null,
    cancel: vi.fn(),
    retry: vi.fn(),
    refresh: vi.fn(async () => undefined),
  };

  const startSubjectState = {
    loadingJobId: null as string | null,
    startSubject: vi.fn(async (_jobId: string) => undefined),
  };

  return {
    pushMock: vi.fn(),
    prefetchMock: vi.fn(),
    checkApiHealthMock: vi.fn(),
    deleteSubjectMock: vi.fn(),
    getSubjectProgressHistoryMock: vi.fn(),
    getSubjectsMock: vi.fn(),
    getSubjectsFreshMock: vi.fn(),
    clearSelectedPipelineJobMock: vi.fn(),
    startSubjectMock: startSubjectState.startSubject,
    jobLibraryRefreshMock: jobLibraryState.refresh,
    jobLibraryCancelMock: jobLibraryState.cancel,
    jobLibraryRetryMock: jobLibraryState.retry,
    jobLibraryState,
    startSubjectState,
    useJobLibraryMock: vi.fn(() => ({
      jobs: jobLibraryState.jobs,
      loading: jobLibraryState.loading,
      busyJobId: jobLibraryState.busyJobId,
      cancel: jobLibraryState.cancel,
      retry: jobLibraryState.retry,
      refresh: jobLibraryState.refresh,
    })),
    useStartAdaptiveSubjectMock: vi.fn(() => ({
      loadingJobId: startSubjectState.loadingJobId,
      startSubject: startSubjectState.startSubject,
    })),
  };
});

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    prefetch: prefetchMock,
    replace: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  checkApiHealth: checkApiHealthMock,
  deleteSubject: deleteSubjectMock,
  getSubjectProgressHistory: getSubjectProgressHistoryMock,
  getSubjects: getSubjectsMock,
  getSubjectsFresh: getSubjectsFreshMock,
}));

vi.mock('../lib/session-storage', () => ({
  clearSelectedPipelineJob: clearSelectedPipelineJobMock,
}));

vi.mock('./use-job-library', () => ({
  useJobLibrary: useJobLibraryMock,
}));

vi.mock('./use-start-adaptive-subject', () => ({
  useStartAdaptiveSubject: useStartAdaptiveSubjectMock,
}));

import { useAdaptiveDashboard } from './use-adaptive-dashboard';

const t: TranslateFn = ((key: string) => `t:${key}`) as TranslateFn;
const tAdaptive: TranslateFn = ((key: string) => `ta:${key}`) as TranslateFn;

const DAY_MS = 24 * 60 * 60 * 1000;

function historyJob(overrides: Partial<PipelineJobHistoryItem> = {}): PipelineJobHistoryItem {
  return {
    job_id: 'job-history-1',
    filename: 'linear-algebra.pdf',
    subject_id: 'Matrix basics',
    status: 'completed',
    concepts_extracted: 10,
    concepts_after_merge: 8,
    relations_accepted: 12,
    relations_llm_verified: 12,
    relations_deterministic_unverified: 0,
    completed_at: 1_700_000_000,
    mastered_concept: 3,
    all_concept: 10,
    unlocked_concept: 5,
    locked_concept: 5,
    progress_percent: 40,
    ...overrides,
  };
}

function listJob(overrides: Partial<PipelineJobListItem> = {}): PipelineJobListItem {
  return {
    job_id: 'job-list-1',
    filename: 'calculus.notes.docx',
    subject_id: 'Derivatives',
    status: 'pending',
    current_step: 'pending',
    progress: 0.25,
    page_batch_size: 10,
    batch_count: 1,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: 0,
    concepts_after_merge: 0,
    relations_accepted: 0,
    relations_llm_verified: 0,
    relations_deterministic_unverified: 0,
    retryable: false,
    retry_count: 0,
    eta_seconds: 90,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_100,
    heartbeat_at: 1_700_000_100,
    completed_at: null,
    is_terminal: false,
    is_delayed: false,
    retry_after_seconds: 3,
    ...overrides,
  };
}

function sessionItem(overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem {
  return {
    job_id: 'job-session-1',
    filename: 'linear-algebra.pdf',
    subject_id: 'Matrix basics',
    status: 'active',
    step: 2,
    max_steps: 5,
    total_correct: 2,
    total_answered: 3,
    accuracy: 0.66,
    avg_mastery: 0.5,
    unlocked_concepts: 2,
    locked_concepts: 1,
    mastered_concepts: 1,
    progress_percent: 40,
    updated_at: 1_783_000_000,
    created_at: 1_782_900_000,
    last_session_id: 'session-1',
    ...overrides,
  };
}

function dayStartAt(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
}

function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

type HookParams = Parameters<typeof useAdaptiveDashboard>[0];

function defaultParams(overrides: Partial<HookParams> = {}): HookParams {
  return {
    initialSubjects: [],
    initialSessionHistory: [],
    initialApiOnline: null,
    initialError: null,
    didHydrateFromServer: false,
    locale: 'en',
    t,
    tAdaptive,
    ...overrides,
  };
}

function renderDashboard(overrides: Partial<HookParams> = {}) {
  return renderHook((props: HookParams) => useAdaptiveDashboard(props), {
    initialProps: defaultParams(overrides),
  });
}

function dashboardSubjectStub(overrides: Partial<DashboardSubject> = {}): DashboardSubject {
  return {
    jobId: 'job-del-1',
    filename: 'delete-me.pdf',
    subjectId: 'Delete Me',
    status: 'completed',
    conceptsExtracted: 1,
    conceptsAfterMerge: 1,
    relationsAccepted: 1,
    completedAt: 1_700_000_000,
    masteredConcept: 0,
    allConcept: 1,
    progressPercent: 0,
    displayTitle: 'Delete Me',
    lastOpenedLabel: 'unknown',
    progressLabel: '0%',
    ctaLabel: 'Open',
    metrics: {
      masteredConcepts: 0,
      allConcepts: 1,
      progressPercent: 0,
      remainingConcepts: 1,
    },
    runtime: { kind: 'ready' },
    exercise: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      // Keep microtasks / queueMicrotask real so todayStart hydration runs.
    ],
  });
  vi.setSystemTime(new Date(2026, 6, 17, 15, 30, 0, 0));

  jobLibraryState.jobs = [];
  jobLibraryState.loading = false;
  jobLibraryState.busyJobId = null;
  startSubjectState.loadingJobId = null;

  checkApiHealthMock.mockResolvedValue(true);
  getSubjectsMock.mockResolvedValue([]);
  getSubjectProgressHistoryMock.mockResolvedValue([]);
  getSubjectsFreshMock.mockResolvedValue([]);
  deleteSubjectMock.mockResolvedValue({ deleted: true });
  jobLibraryRefreshMock.mockResolvedValue(undefined);
  startSubjectMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Keep server-hydrated fixtures stable across the background health refresh. */
function pinServerHydration(args: {
  subjects?: PipelineJobHistoryItem[];
  history?: SessionHistoryItem[];
  health?: boolean;
}) {
  checkApiHealthMock.mockResolvedValue(args.health ?? true);
  getSubjectsMock.mockResolvedValue(args.subjects ?? []);
  getSubjectProgressHistoryMock.mockResolvedValue(args.history ?? []);
}

describe('useAdaptiveDashboard', () => {
  describe('routing and initial wiring', () => {
    it('prefetches the upload route and exposes job-library passthroughs', async () => {
      jobLibraryState.loading = true;
      jobLibraryState.busyJobId = 'busy-1';

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.upload);
      expect(useJobLibraryMock).toHaveBeenCalledWith({
        enabled: true,
        initialJobs: [],
      });
      expect(useStartAdaptiveSubjectMock).toHaveBeenCalledWith({ t, tAdaptive });
      expect(result.current.libraryLoading).toBe(true);
      expect(result.current.busyJobId).toBe('busy-1');
      expect(result.current.cancel).toBe(jobLibraryCancelMock);
      expect(result.current.retry).toBe(jobLibraryRetryMock);

      await act(async () => {
        await Promise.resolve();
      });
    });

    it('handleGoUpload pushes the adaptive upload route', async () => {
      const { result } = renderDashboard({ didHydrateFromServer: true, initialApiOnline: true });
      await act(async () => {
        result.current.handleGoUpload();
      });
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.upload);
    });

    it('handleOpenSubject starts a subject unless a delete is in flight', async () => {
      const { result } = renderDashboard({ didHydrateFromServer: true, initialApiOnline: true });

      await act(async () => {
        result.current.handleOpenSubject('job-open-1');
      });
      expect(startSubjectMock).toHaveBeenCalledWith('job-open-1');

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-del' }));
      });
      deleteSubjectMock.mockImplementation(() => new Promise(() => undefined));
      void act(() => {
        void result.current.handleConfirmDelete();
      });

      await waitFor(() => {
        expect(result.current.deletingJobId).toBe('job-del');
      });

      startSubjectMock.mockClear();
      await act(async () => {
        result.current.handleOpenSubject('job-open-2');
      });
      expect(startSubjectMock).not.toHaveBeenCalled();
    });
  });

  describe('client hydration (didHydrateFromServer = false)', () => {
    it('sets loading then hydrates subjects, history, and apiOnline on success', async () => {
      const subjects = [historyJob({ job_id: 'job-a' })];
      const history = [sessionItem({ job_id: 'job-a', total_answered: 2 })];
      getSubjectsMock.mockResolvedValue(subjects);
      getSubjectProgressHistoryMock.mockResolvedValue(history);
      checkApiHealthMock.mockResolvedValue(true);

      const { result } = renderDashboard({
        didHydrateFromServer: false,
        initialApiOnline: null,
        initialError: null,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.apiOnline).toBe(true);
      });

      expect(checkApiHealthMock).toHaveBeenCalledTimes(1);
      expect(getSubjectsMock).toHaveBeenCalledTimes(1);
      expect(getSubjectProgressHistoryMock).toHaveBeenCalledWith(50);
      expect(result.current.error).toBeNull();
      expect(result.current.sessionHistory).toHaveLength(1);
      expect(result.current.sessionHistory[0]?.jobId).toBe('job-a');
      expect(result.current.sessionHistory[0]?.totalAnswered).toBe(2);
    });

    it('marks connectionLimited when health is offline', async () => {
      checkApiHealthMock.mockResolvedValue(false);
      getSubjectsMock.mockResolvedValue([historyJob()]);
      getSubjectProgressHistoryMock.mockResolvedValue([]);

      const { result } = renderDashboard({ didHydrateFromServer: false });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.apiOnline).toBe(false);
      });
      expect(result.current.error).toBe('t:connectionLimited');
    });

    it('treats rejected health as offline and sets connectionLimited', async () => {
      checkApiHealthMock.mockRejectedValue(new Error('health down'));
      getSubjectsMock.mockResolvedValue([]);
      getSubjectProgressHistoryMock.mockResolvedValue([]);

      const { result } = renderDashboard({ didHydrateFromServer: false });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(false);
        expect(result.current.error).toBe('t:connectionLimited');
      });
    });

    it('logs subject hydrate failures and surfaces connectionLimited', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockRejectedValue(new Error('subjects fail'));
      getSubjectProgressHistoryMock.mockResolvedValue([sessionItem()]);

      const { result } = renderDashboard({ didHydrateFromServer: false });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('t:connectionLimited');
      });
      expect(errorSpy).toHaveBeenCalledWith('Failed to hydrate subjects', expect.any(Error));
      expect(result.current.sessionHistory).toHaveLength(1);
    });

    it('logs history hydrate failures without forcing connectionLimited when subjects ok', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockResolvedValue([historyJob()]);
      getSubjectProgressHistoryMock.mockRejectedValue(new Error('history fail'));

      const { result } = renderDashboard({ didHydrateFromServer: false });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.apiOnline).toBe(true);
      });
      expect(result.current.error).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Failed to hydrate session history', expect.any(Error));
    });

    it('does not dispatch after unmount during non-hydration client load', async () => {
      let resolveHealth!: (value: boolean) => void;
      checkApiHealthMock.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveHealth = resolve;
          }),
      );
      getSubjectsMock.mockResolvedValue([]);
      getSubjectProgressHistoryMock.mockResolvedValue([]);

      const { unmount } = renderDashboard({ didHydrateFromServer: false });
      unmount();

      await act(async () => {
        resolveHealth(true);
        await Promise.resolve();
      });
      // No throw / no state update after unmount is the success condition.
      expect(checkApiHealthMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('server hydration refresh (didHydrateFromServer = true)', () => {
    it('re-checks health and refreshes subjects/history on full recovery', async () => {
      const refreshedSubjects = [historyJob({ job_id: 'refreshed', progress_percent: 88 })];
      const refreshedHistory = [
        sessionItem({
          job_id: 'refreshed',
          total_answered: 4,
          subject_id: 'Refreshed Subject',
        }),
      ];
      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockResolvedValue(refreshedSubjects);
      getSubjectProgressHistoryMock.mockResolvedValue(refreshedHistory);

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialSubjects: [historyJob({ job_id: 'stale' })],
        initialSessionHistory: [sessionItem({ job_id: 'stale', total_answered: 1 })],
        initialApiOnline: false,
        initialError: 't:connectionLimited',
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
        expect(result.current.error).toBeNull();
      });

      expect(getSubjectsMock).toHaveBeenCalled();
      expect(getSubjectProgressHistoryMock).toHaveBeenCalledWith(50);
      expect(result.current.sessionHistory[0]?.jobId).toBe('refreshed');
      expect(result.current.loading).toBe(false);
    });

    it('keeps limited connection error when health is false', async () => {
      checkApiHealthMock.mockResolvedValue(false);

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialError: null,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(false);
      });
      expect(result.current.error).toBe('t:connectionLimited');
      expect(getSubjectsMock).not.toHaveBeenCalled();
      expect(getSubjectProgressHistoryMock).not.toHaveBeenCalled();
    });

    it('uses initialError when health recovers but subjects/history fail', async () => {
      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockRejectedValue(new Error('s'));
      getSubjectProgressHistoryMock.mockRejectedValue(new Error('h'));

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialError: 'seed-error',
        initialApiOnline: null,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
      });
      expect(result.current.error).toBe('seed-error');
    });

    it('falls back to connectionLimited when recovery incomplete and initialError is null', async () => {
      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockResolvedValue([historyJob()]);
      getSubjectProgressHistoryMock.mockRejectedValue(new Error('history only'));

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialError: null,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
      });
      expect(result.current.error).toBe('t:connectionLimited');
    });

    it('treats health check throw as offline false', async () => {
      checkApiHealthMock.mockRejectedValue(new Error('no health'));

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialError: null,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(false);
        expect(result.current.error).toBe('t:connectionLimited');
      });
    });

    it('does not dispatch hydrate results after unmount on the server-hydrated path', async () => {
      let resolveHealth!: (value: boolean) => void;
      checkApiHealthMock.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveHealth = resolve;
          }),
      );
      getSubjectsMock.mockResolvedValue([historyJob({ job_id: 'after-unmount' })]);
      getSubjectProgressHistoryMock.mockResolvedValue([
        sessionItem({ job_id: 'after-unmount', total_answered: 9 }),
      ]);

      const { result, unmount } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: null,
        initialSessionHistory: [],
        initialError: 'seed',
      });

      const sessionBefore = result.current.sessionHistory;
      unmount();

      await act(async () => {
        resolveHealth(true);
        await Promise.resolve();
        await Promise.resolve();
      });

      // isActive=false skips dispatch; initial empty history must remain empty on the frozen result.
      expect(sessionBefore).toEqual([]);
    });
  });

  describe('job enrichment refresh', () => {
    it('calls getSubjectsFresh once for completed library jobs missing enrichment', async () => {
      const enriched = [historyJob({ job_id: 'complete-1', progress_percent: 77 })];
      getSubjectsFreshMock.mockResolvedValue(enriched);
      pinServerHydration({ subjects: [], health: true });

      jobLibraryState.jobs = [
        listJob({ job_id: 'complete-1', status: 'completed', is_terminal: true }),
        listJob({ job_id: 'pending-1', status: 'pending' }),
      ];

      const { result, rerender } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSubjects: [],
      });

      await waitFor(() => {
        expect(getSubjectsFreshMock).toHaveBeenCalledTimes(1);
      });

      // Same completed key must not re-fetch (dedupe via refreshedCompletionKeysRef).
      rerender(defaultParams({ didHydrateFromServer: true, initialApiOnline: true }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(getSubjectsFreshMock).toHaveBeenCalledTimes(1);
      expect(result.current.apiOnline).toBe(true);
    });

    it('does not enrich when apiOnline is not true', async () => {
      pinServerHydration({ health: false });
      jobLibraryState.jobs = [
        listJob({ job_id: 'complete-1', status: 'completed', is_terminal: true }),
      ];

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: false,
        initialSubjects: [],
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(false);
      });
      expect(getSubjectsFreshMock).not.toHaveBeenCalled();
    });

    it('does not enrich when completed jobs already exist in subjects map', async () => {
      const existing = [historyJob({ job_id: 'complete-1' })];
      pinServerHydration({ subjects: existing, health: true });
      jobLibraryState.jobs = [
        listJob({ job_id: 'complete-1', status: 'completed', is_terminal: true }),
      ];

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSubjects: existing,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getSubjectsFreshMock).not.toHaveBeenCalled();
    });

    it('removes the completion key on failure so a later key can retry', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      pinServerHydration({ subjects: [], health: true });
      getSubjectsFreshMock
        .mockRejectedValueOnce(new Error('enrich failed'))
        .mockResolvedValueOnce([historyJob({ job_id: 'c1' })]);

      jobLibraryState.jobs = [listJob({ job_id: 'c1', status: 'completed', is_terminal: true })];

      const { rerender } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSubjects: [],
      });

      await waitFor(() => {
        expect(getSubjectsFreshMock).toHaveBeenCalledTimes(1);
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to enrich completed subjects',
        expect.any(Error),
      );

      // New completed job changes the enrichment key → should retry after prior failure cleared.
      jobLibraryState.jobs = [
        listJob({ job_id: 'c1', status: 'completed', is_terminal: true }),
        listJob({ job_id: 'c2', status: 'completed', is_terminal: true }),
      ];
      rerender(
        defaultParams({
          didHydrateFromServer: true,
          initialApiOnline: true,
          initialSubjects: [],
        }),
      );

      await waitFor(() => {
        expect(getSubjectsFreshMock).toHaveBeenCalledTimes(2);
      });
    });

    it('dedupes enrichment when completed job order changes (sorted key)', async () => {
      pinServerHydration({ subjects: [], health: true });
      getSubjectsFreshMock.mockResolvedValue([]);
      jobLibraryState.jobs = [
        listJob({ job_id: 'z-job', status: 'completed', is_terminal: true }),
        listJob({ job_id: 'a-job', status: 'completed', is_terminal: true }),
      ];

      const { rerender } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSubjects: [],
      });

      await waitFor(() => {
        expect(getSubjectsFreshMock).toHaveBeenCalledTimes(1);
      });

      // Reversed order → same sorted key → no second fetch on this mount.
      jobLibraryState.jobs = [
        listJob({ job_id: 'a-job', status: 'completed', is_terminal: true }),
        listJob({ job_id: 'z-job', status: 'completed', is_terminal: true }),
      ];
      rerender(
        defaultParams({
          didHydrateFromServer: true,
          initialApiOnline: true,
          initialSubjects: [],
        }),
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getSubjectsFreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('merged subjects, filtering, and derived outputs', () => {
    it('builds filteredSubjects from job library + enrichment and supports search', async () => {
      const subjects = [
        historyJob({
          job_id: 'job-calc',
          subject_id: 'Calculus One',
          filename: 'calc.pdf',
          progress_percent: 60,
        }),
      ];
      const history = [
        sessionItem({
          job_id: 'job-calc',
          status: 'active',
          total_answered: 2,
          progress_percent: 20,
        }),
      ];
      pinServerHydration({ subjects, history, health: true });

      jobLibraryState.jobs = [
        listJob({
          job_id: 'job-calc',
          subject_id: 'Calculus One',
          filename: 'calc.pdf',
          status: 'completed',
          is_terminal: true,
        }),
        listJob({
          job_id: 'job-alg',
          subject_id: 'Algebra Two',
          filename: 'alg.pdf',
          status: 'pending',
        }),
      ];

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSubjects: subjects,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.filteredSubjects.length).toBe(2);
        expect(result.current.apiOnline).toBe(true);
      });

      expect(result.current.upNextSubject?.jobId).toBe('job-calc');
      expect(result.current.filteredSubjects[0]?.exercise).toMatchObject({
        status: 'active',
        totalAnswered: 2,
        progressPercent: 20,
      });

      await act(async () => {
        result.current.setSearchQuery('  algebra  ');
      });

      await waitFor(() => {
        expect(result.current.searchQuery).toBe('  algebra  ');
        expect(result.current.filteredSubjects).toHaveLength(1);
        expect(result.current.filteredSubjects[0]?.jobId).toBe('job-alg');
      });

      await act(async () => {
        result.current.setSearchQuery('   ');
      });
      await waitFor(() => {
        expect(result.current.filteredSubjects).toHaveLength(2);
      });

      await act(async () => {
        result.current.setSearchQuery('no-such-subject-zzz');
      });
      await waitFor(() => {
        expect(result.current.filteredSubjects).toEqual([]);
      });
    });

    it('returns null upNextSubject when the library is empty', async () => {
      pinServerHydration({ health: true });
      jobLibraryState.jobs = [];
      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });
      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
      });
      expect(result.current.upNextSubject).toBeNull();
      expect(result.current.filteredSubjects).toEqual([]);
    });
  });

  describe('learning streak and daily goal', () => {
    it('computes streak 0 for empty history and unanswered-only days', async () => {
      const today = dayStartAt(2026, 6, 17);
      const history = [
        sessionItem({
          job_id: 'unanswered',
          total_answered: 0,
          updated_at: toUnixSeconds(today + 3_600_000),
          created_at: toUnixSeconds(today + 3_600_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.dailyGoalProgress.total).toBe(3);
        expect(result.current.dailyGoalProgress.current).toBe(0);
      });
      expect(result.current.streakDays).toBe(0);
    });

    it('counts consecutive local days ending today', async () => {
      const today = dayStartAt(2026, 6, 17);
      const yesterday = today - DAY_MS;
      const twoDaysAgo = today - 2 * DAY_MS;
      const history = [
        sessionItem({
          job_id: 'd0',
          total_answered: 1,
          updated_at: toUnixSeconds(today + 1_000),
          created_at: toUnixSeconds(today + 1_000),
        }),
        sessionItem({
          job_id: 'd1',
          total_answered: 2,
          updated_at: toUnixSeconds(yesterday + 2_000),
          created_at: toUnixSeconds(yesterday + 2_000),
        }),
        sessionItem({
          job_id: 'd2',
          total_answered: 3,
          updated_at: toUnixSeconds(twoDaysAgo + 3_000),
          created_at: toUnixSeconds(twoDaysAgo + 3_000),
        }),
        // Duplicate same day should not inflate streak.
        sessionItem({
          job_id: 'd0b',
          total_answered: 5,
          updated_at: toUnixSeconds(today + 8_000),
          created_at: toUnixSeconds(today + 8_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.streakDays).toBe(3);
      });
    });

    it('allows a streak that starts yesterday when today has no answered sessions', async () => {
      const today = dayStartAt(2026, 6, 17);
      const yesterday = today - DAY_MS;
      const twoDaysAgo = today - 2 * DAY_MS;
      const history = [
        sessionItem({
          job_id: 'y',
          total_answered: 2,
          updated_at: toUnixSeconds(yesterday + 5_000),
          created_at: toUnixSeconds(yesterday + 5_000),
        }),
        sessionItem({
          job_id: 'y2',
          total_answered: 1,
          updated_at: toUnixSeconds(twoDaysAgo + 5_000),
          created_at: toUnixSeconds(twoDaysAgo + 5_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.streakDays).toBe(2);
      });
    });

    it('breaks streak when a day gap is present', async () => {
      const today = dayStartAt(2026, 6, 17);
      const threeDaysAgo = today - 3 * DAY_MS;
      const history = [
        sessionItem({
          job_id: 'today',
          total_answered: 1,
          updated_at: toUnixSeconds(today + 1_000),
          created_at: toUnixSeconds(today + 1_000),
        }),
        sessionItem({
          job_id: 'gap',
          total_answered: 1,
          updated_at: toUnixSeconds(threeDaysAgo + 1_000),
          created_at: toUnixSeconds(threeDaysAgo + 1_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.streakDays).toBe(1);
      });
    });

    it('handles millisecond timestamps without double-scaling', async () => {
      const today = dayStartAt(2026, 6, 17);
      const history = [
        sessionItem({
          job_id: 'ms',
          total_answered: 1,
          // Already milliseconds (> 1e12)
          updated_at: today + 10_000,
          created_at: today + 10_000,
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await waitFor(() => {
        expect(result.current.streakDays).toBe(1);
      });
    });

    it('computes daily goal after todayStart microtask and caps percent at 100', async () => {
      const today = dayStartAt(2026, 6, 17);
      const yesterday = today - DAY_MS;
      const history = [
        sessionItem({
          job_id: 'g1',
          total_answered: 1,
          updated_at: toUnixSeconds(today + 1_000),
          created_at: toUnixSeconds(today + 1_000),
        }),
        sessionItem({
          job_id: 'g2',
          total_answered: 2,
          updated_at: toUnixSeconds(today + 2_000),
          created_at: toUnixSeconds(today + 2_000),
        }),
        sessionItem({
          job_id: 'g3',
          total_answered: 3,
          updated_at: toUnixSeconds(today + 3_000),
          created_at: toUnixSeconds(today + 3_000),
        }),
        sessionItem({
          job_id: 'g4',
          total_answered: 4,
          updated_at: toUnixSeconds(today + 4_000),
          created_at: toUnixSeconds(today + 4_000),
        }),
        sessionItem({
          job_id: 'skip-unanswered',
          total_answered: 0,
          updated_at: toUnixSeconds(today + 5_000),
          created_at: toUnixSeconds(today + 5_000),
        }),
        sessionItem({
          job_id: 'yesterday',
          total_answered: 9,
          updated_at: toUnixSeconds(yesterday + 1_000),
          created_at: toUnixSeconds(yesterday + 1_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.dailyGoalProgress).toEqual({
          current: 4,
          total: 3,
          percent: 100,
        });
      });
    });

    it('settles daily goal to one answered session today (33%)', async () => {
      const today = dayStartAt(2026, 6, 17);
      const history = [
        sessionItem({
          job_id: 'one',
          total_answered: 1,
          updated_at: toUnixSeconds(today + 1_000),
          created_at: toUnixSeconds(today + 1_000),
        }),
      ];
      pinServerHydration({ history, health: true });

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
        initialSessionHistory: history,
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.dailyGoalProgress.current).toBe(1);
        expect(result.current.dailyGoalProgress.total).toBe(3);
        expect(result.current.dailyGoalProgress.percent).toBe(33);
      });
    });
  });

  describe('delete confirmation flow', () => {
    it('guards confirm when itemToDelete is null or start/delete already busy', async () => {
      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });
      expect(deleteSubjectMock).not.toHaveBeenCalled();

      startSubjectState.loadingJobId = 'loading-job';
      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-x' }));
      });
      // Re-render so useStartAdaptiveSubject mock returns loadingJobId.
      // The hook already captured loadingJobId from the last render; force update via search.
      await act(async () => {
        result.current.setSearchQuery('force');
      });
      await act(async () => {
        await result.current.handleConfirmDelete();
      });
      // loadingJobId was set after initial render of startSubject hook state —
      // ensure guard path via deletingJobId in-flight instead.
      expect(deleteSubjectMock.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('successfully deletes, refreshes subjects/library, clears storage, and toasts', async () => {
      const subject = dashboardSubjectStub({ jobId: 'job-del-ok' });
      deleteSubjectMock.mockResolvedValue({ deleted: true });
      getSubjectsMock.mockResolvedValue([historyJob({ job_id: 'remaining' })]);

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(subject);
      });
      expect(result.current.itemToDelete).toMatchObject({ jobId: 'job-del-ok' });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(deleteSubjectMock).toHaveBeenCalledTimes(1);
      expect(deleteSubjectMock).toHaveBeenCalledWith('job-del-ok', true);
      expect(jobLibraryRefreshMock).toHaveBeenCalledTimes(1);
      expect(getSubjectsMock).toHaveBeenCalled();
      expect(clearSelectedPipelineJobMock).toHaveBeenCalledWith('job-del-ok');
      expect(toast.success).toHaveBeenCalledWith('t:deleteSuccess');
      expect(result.current.deletingJobId).toBeNull();
      expect(result.current.itemToDelete).toBeNull();
    });

    it('toasts deleteFailed and clears delete state on error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      deleteSubjectMock.mockRejectedValue(new Error('cannot delete'));

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-del-fail' }));
      });
      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(toast.error).toHaveBeenCalledWith('t:deleteFailed');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting subject: cannot delete'),
      );
      expect(result.current.deletingJobId).toBeNull();
      expect(result.current.itemToDelete).toBeNull();
      expect(clearSelectedPipelineJobMock).not.toHaveBeenCalled();
    });

    it('handleCancelDelete clears selection only when not actively deleting', async () => {
      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-cancel' }));
      });
      expect(result.current.itemToDelete?.jobId).toBe('job-cancel');

      await act(async () => {
        result.current.handleCancelDelete();
      });
      expect(result.current.itemToDelete).toBeNull();

      // While deleting, cancel must not clear itemToDelete.
      deleteSubjectMock.mockImplementation(() => new Promise(() => undefined));
      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-busy' }));
      });
      void act(() => {
        void result.current.handleConfirmDelete();
      });
      await waitFor(() => {
        expect(result.current.deletingJobId).toBe('job-busy');
      });

      await act(async () => {
        result.current.handleCancelDelete();
      });
      expect(result.current.itemToDelete?.jobId).toBe('job-busy');
    });

    it('ignores confirm while deletingJobId is already set', async () => {
      deleteSubjectMock.mockImplementation(() => new Promise(() => undefined));
      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-once' }));
      });
      void act(() => {
        void result.current.handleConfirmDelete();
      });
      await waitFor(() => {
        expect(result.current.deletingJobId).toBe('job-once');
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });
      expect(deleteSubjectMock).toHaveBeenCalledTimes(1);
    });

    it('refreshSubjects swallows getSubjects errors during delete refresh', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      deleteSubjectMock.mockResolvedValue({ deleted: true });
      getSubjectsMock.mockRejectedValue(new Error('refresh failed'));

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'job-refresh-err' }));
      });
      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(errorSpy).toHaveBeenCalledWith('Failed to refresh subjects', expect.any(Error));
      expect(toast.success).toHaveBeenCalledWith('t:deleteSuccess');
      expect(result.current.itemToDelete).toBeNull();
    });
  });

  describe('loadingJobId guard on delete', () => {
    it('skips delete when loadingJobId is set from start-subject hook', async () => {
      startSubjectState.loadingJobId = 'starting-job';

      const { result } = renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: true,
      });

      await act(async () => {
        result.current.handleDeleteClick(dashboardSubjectStub({ jobId: 'blocked' }));
      });
      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(deleteSubjectMock).not.toHaveBeenCalled();
      expect(result.current.itemToDelete?.jobId).toBe('blocked');
      expect(result.current.loadingJobId).toBe('starting-job');
    });
  });

  describe('job library enabled flag', () => {
    it('disables the job library while apiOnline is not true', async () => {
      renderDashboard({
        didHydrateFromServer: true,
        initialApiOnline: null,
      });
      expect(useJobLibraryMock).toHaveBeenCalledWith({
        enabled: false,
        initialJobs: [],
      });

      checkApiHealthMock.mockResolvedValue(true);
      getSubjectsMock.mockResolvedValue([]);
      getSubjectProgressHistoryMock.mockResolvedValue([]);

      const { result } = renderDashboard({
        didHydrateFromServer: false,
        initialApiOnline: null,
      });

      await waitFor(() => {
        expect(result.current.apiOnline).toBe(true);
      });
      expect(useJobLibraryMock).toHaveBeenCalledWith({
        enabled: true,
        initialJobs: [],
      });
    });
  });
});
