/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { createSessionFromPipeline } from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import {
  saveActiveSessionId,
  saveSessionJobMapping,
} from '@/features/adaptive/lib/session-storage';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import { useStartAdaptiveSubject } from './use-start-adaptive-subject';

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
}));

vi.mock('@/features/adaptive/lib/session-storage', () => ({
  saveActiveSessionId: vi.fn(),
  saveSessionJobMapping: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createSessionMock = vi.mocked(createSessionFromPipeline);
const saveActiveMock = vi.mocked(saveActiveSessionId);
const saveMappingMock = vi.mocked(saveSessionJobMapping);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);

const t: TranslateFn = ((key: string) => `t:${key}`) as TranslateFn;
const tAdaptive: TranslateFn = ((key: string) => `ta:${key}`) as TranslateFn;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useStartAdaptiveSubject', () => {
  it('returns loadingJobId null initially and exposes startSubject', () => {
    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    expect(result.current.loadingJobId).toBeNull();
    expect(typeof result.current.startSubject).toBe('function');
  });

  it('starts a session: storage mapping, success toast, subject route, and loadingJobId while in flight', async () => {
    const pending = deferred<Awaited<ReturnType<typeof createSessionFromPipeline>>>();
    createSessionMock.mockReturnValueOnce(pending.promise);

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.startSubject('job-1');
    });

    await waitFor(() => expect(result.current.loadingJobId).toBe('job-1'));
    expect(createSessionMock).toHaveBeenCalledWith('job-1', 50);

    await act(async () => {
      pending.resolve({
        session_id: 'session-new',
        n_concepts: 3,
        source: 'new_session',
        job_id: 'job-1',
        status: 'active',
      });
      await startPromise;
    });

    expect(saveActiveMock).toHaveBeenCalledWith('session-new');
    expect(saveMappingMock).toHaveBeenCalledWith('session-new', 'job-1');
    expect(toastSuccessMock).toHaveBeenCalledWith('t:creatingSession');
    expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.subject('session-new'));
    // success path intentionally leaves loadingJobId set (guards double-starts)
    expect(result.current.loadingJobId).toBe('job-1');
  });

  it('maps existing_session success the same way (storage + route + toast key)', async () => {
    createSessionMock.mockResolvedValueOnce({
      session_id: 'session-existing',
      n_concepts: 1,
      source: 'existing_session',
      job_id: 'job-2',
      status: 'active',
    });

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    await act(async () => {
      await result.current.startSubject('job-2');
    });

    expect(createSessionMock).toHaveBeenCalledWith('job-2', 50);
    expect(saveActiveMock).toHaveBeenCalledWith('session-existing');
    expect(saveMappingMock).toHaveBeenCalledWith('session-existing', 'job-2');
    expect(toastSuccessMock).toHaveBeenCalledWith('t:creatingSession');
    expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.subject('session-existing'));
    expect(result.current.loadingJobId).toBe('job-2');
  });

  it('guards concurrent starts while loadingJobId is set', async () => {
    const pending = deferred<Awaited<ReturnType<typeof createSessionFromPipeline>>>();
    createSessionMock.mockReturnValueOnce(pending.promise);

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    act(() => {
      void result.current.startSubject('job-a');
    });
    await waitFor(() => expect(result.current.loadingJobId).toBe('job-a'));

    await act(async () => {
      await result.current.startSubject('job-b');
    });

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(createSessionMock).toHaveBeenCalledWith('job-a', 50);
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({
        session_id: 'session-a',
        n_concepts: 1,
        source: 'new_session',
        job_id: 'job-a',
        status: 'active',
      });
    });
  });

  it('on error: toast from adaptive feedback, clears loadingJobId, does not write storage or route', async () => {
    createSessionMock.mockRejectedValueOnce(
      new AdaptiveApiError({
        message: 'not ready',
        code: 'pipeline_not_completed',
        status: 409,
        retryable: true,
      }),
    );

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    await act(async () => {
      await result.current.startSubject('job-err');
    });

    expect(toastErrorMock).toHaveBeenCalledWith('ta:dashboard.sessionNotReady');
    expect(result.current.loadingJobId).toBeNull();
    expect(saveActiveMock).not.toHaveBeenCalled();
    expect(saveMappingMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('on generic error uses sessionOpenFailed and still clears loadingJobId', async () => {
    createSessionMock.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    await act(async () => {
      await result.current.startSubject('job-generic');
    });

    expect(toastErrorMock).toHaveBeenCalledWith('ta:dashboard.sessionOpenFailed');
    expect(result.current.loadingJobId).toBeNull();
  });

  it('allows a second start after an error cleared loadingJobId', async () => {
    createSessionMock.mockRejectedValueOnce(new Error('first fail')).mockResolvedValueOnce({
      session_id: 'session-retry',
      n_concepts: 2,
      source: 'new_session',
      job_id: 'job-retry',
      status: 'active',
    });

    const { result } = renderHook(() => useStartAdaptiveSubject({ t, tAdaptive }));

    await act(async () => {
      await result.current.startSubject('job-retry');
    });
    expect(result.current.loadingJobId).toBeNull();

    await act(async () => {
      await result.current.startSubject('job-retry');
    });

    expect(createSessionMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.subject('session-retry'));
    expect(result.current.loadingJobId).toBe('job-retry');
  });
});
