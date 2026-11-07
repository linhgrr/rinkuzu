/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCancelProcessingConfirm } from '../use-cancel-processing-confirm';

describe('useCancelProcessingConfirm (RIN-1005)', () => {
  it('asks before cancelling: a request only opens the confirmation', () => {
    const cancel = vi.fn<(jobId: string) => Promise<string | null>>();
    const { result } = renderHook(() => useCancelProcessingConfirm(cancel));

    act(() => result.current.request('job-1'));

    expect(result.current.targetJobId).toBe('job-1');
    expect(cancel).not.toHaveBeenCalled();
  });

  it('closes the confirmation once the cancel succeeds', async () => {
    const cancel = vi.fn<(jobId: string) => Promise<string | null>>().mockResolvedValue(null);
    const { result } = renderHook(() => useCancelProcessingConfirm(cancel));

    act(() => result.current.request('job-1'));
    await act(async () => result.current.confirm());

    expect(cancel).toHaveBeenCalledWith('job-1');
    expect(result.current.targetJobId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  it('keeps the confirmation open with the error when the cancel fails', async () => {
    const cancel = vi
      .fn<(jobId: string) => Promise<string | null>>()
      .mockResolvedValue('Something went wrong');
    const { result } = renderHook(() => useCancelProcessingConfirm(cancel));

    act(() => result.current.request('job-1'));
    await act(async () => result.current.confirm());

    expect(result.current.targetJobId).toBe('job-1');
    expect(result.current.error).toBe('Something went wrong');
    expect(result.current.pending).toBe(false);
  });

  it('clears an old error when the learner dismisses or asks again', async () => {
    const cancel = vi.fn<(jobId: string) => Promise<string | null>>().mockResolvedValue('Failed');
    const { result } = renderHook(() => useCancelProcessingConfirm(cancel));

    act(() => result.current.request('job-1'));
    await act(async () => result.current.confirm());
    act(() => result.current.dismiss());

    expect(result.current.targetJobId).toBeNull();
    expect(result.current.error).toBeNull();

    act(() => result.current.request('job-2'));
    expect(result.current.error).toBeNull();
  });

  it('does not close or cancel twice while a cancel is in flight', async () => {
    let resolveCancel: (value: string | null) => void = () => {};
    const cancel = vi.fn<(jobId: string) => Promise<string | null>>(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve;
        }),
    );
    const { result } = renderHook(() => useCancelProcessingConfirm(cancel));

    act(() => result.current.request('job-1'));
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.confirm();
    });
    expect(result.current.pending).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.targetJobId).toBe('job-1');
    await act(async () => result.current.confirm());
    expect(cancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCancel(null);
      await first;
    });
    expect(result.current.targetJobId).toBeNull();
  });
});
