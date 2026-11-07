/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import viErrors from '@/../messages/vi/errors.json';
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

// The hook localizes errors through next-intl (RIN-754), so it needs the provider.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="vi" messages={{ errors: viErrors }}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderJobLibrary(enabled: boolean) {
  return renderHook(() => useJobLibrary({ enabled }), { wrapper: Wrapper });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useJobLibrary', () => {
  it('keeps the disabled default state idle without polling', () => {
    const { result } = renderJobLibrary(false);

    expect(result.current).toMatchObject({ jobs: [], loading: false, busyJobId: null });
    expect(listJobsMock).not.toHaveBeenCalled();
  });

  it('starts polling when enabled and settles loading after the first tick', async () => {
    listJobsMock.mockResolvedValue([]);
    const { result } = renderJobLibrary(true);

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listJobsMock).toHaveBeenCalledTimes(1);
  });

  it('reports retry failures as a localized toast without leaking a busy state', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    retryJobMock.mockRejectedValueOnce(new Error('retry failed'));
    const { result } = renderJobLibrary(false);

    await act(async () => result.current.retry('job-retry'));
    expect(toastErrorMock).toHaveBeenCalledWith(viErrors.api.generic);
    expect(toastErrorMock).not.toHaveBeenCalledWith('retry failed');
    expect(result.current.busyJobId).toBeNull();
  });

  it('returns a cancel failure as localized copy for the confirm dialog, not a toast (RIN-1005)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    cancelJobMock.mockRejectedValueOnce('cancel failed');
    const { result } = renderJobLibrary(false);

    let outcome: string | null | undefined;
    await act(async () => {
      outcome = await result.current.cancel('job-cancel');
    });
    expect(outcome).toBe(viErrors.api.generic);
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(result.current.busyJobId).toBeNull();
  });

  it('returns null when the cancel succeeds (RIN-1005)', async () => {
    cancelJobMock.mockResolvedValueOnce({ job_id: 'job-cancel', status: 'cancelling' });
    listJobsMock.mockResolvedValue([]);
    const { result } = renderJobLibrary(false);

    let outcome: string | null | undefined;
    await act(async () => {
      outcome = await result.current.cancel('job-cancel');
    });
    expect(outcome).toBeNull();
    expect(cancelJobMock).toHaveBeenCalledWith('job-cancel');
  });
});
