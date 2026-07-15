/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import {
  cancelPipelineJob,
  listPipelineJobs,
  retryPipelineJob,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { useJobLibrary } from '../use-job-library';

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  cancelPipelineJob: vi.fn(),
  listPipelineJobs: vi.fn(),
  retryPipelineJob: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const listJobsMock = vi.mocked(listPipelineJobs);
const retryJobMock = vi.mocked(retryPipelineJob);
const cancelJobMock = vi.mocked(cancelPipelineJob);
const toastErrorMock = vi.mocked(toast.error);

afterEach(() => {
  vi.clearAllMocks();
});

describe('useJobLibrary', () => {
  it('keeps the disabled default state idle without polling', () => {
    const { result } = renderHook(() => useJobLibrary({ enabled: false }));

    expect(result.current).toMatchObject({ jobs: [], loading: false, busyJobId: null });
    expect(listJobsMock).not.toHaveBeenCalled();
  });

  it('starts polling when enabled and settles loading after the first tick', async () => {
    listJobsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useJobLibrary({ enabled: true }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listJobsMock).toHaveBeenCalledTimes(1);
  });

  it('reports retry and cancel failures without leaking a busy state', async () => {
    retryJobMock.mockRejectedValueOnce(new Error('retry failed'));
    cancelJobMock.mockRejectedValueOnce('cancel failed');
    const { result } = renderHook(() => useJobLibrary({ enabled: false }));

    await act(async () => result.current.retry('job-retry'));
    expect(toastErrorMock).toHaveBeenCalledWith('retry failed');
    expect(result.current.busyJobId).toBeNull();

    await act(async () => result.current.cancel('job-cancel'));
    expect(toastErrorMock).toHaveBeenCalledWith('Failed to cancel job');
    expect(result.current.busyJobId).toBeNull();
  });
});
