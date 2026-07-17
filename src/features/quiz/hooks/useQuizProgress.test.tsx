/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedQuizProgress } from '@/features/quiz/types/quiz-interaction-view-model';
import { useQuizProgress } from './useQuizProgress';

const mocks = vi.hoisted(() => ({
  deleteSavedQuizProgress: vi.fn(),
  loadSavedQuizProgress: vi.fn(),
  saveQuizProgress: vi.fn(),
}));

vi.mock('@/features/quiz/api/quiz-interaction-api', () => mocks);

const progress = {
  questionOrder: [0, 1, 2],
  optionOrders: [
    [0, 1],
    [0, 1],
    [0, 1],
  ],
  userAnswers: [0, [], 1],
  currentQuestionIndex: 2,
  answeredCount: 2,
  totalQuestions: 3,
} satisfies SavedQuizProgress;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useQuizProgress', () => {
  it('does not read, write, or delete progress while disabled', async () => {
    const { result } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: false, debounceMs: 50 }),
    );

    expect(await result.current.loadProgress()).toBeNull();
    act(() => result.current.saveProgress(progress));
    await act(async () => vi.advanceTimersByTimeAsync(50));
    await act(async () => result.current.clearProgress());

    expect(mocks.loadSavedQuizProgress).not.toHaveBeenCalled();
    expect(mocks.saveQuizProgress).not.toHaveBeenCalled();
    expect(mocks.deleteSavedQuizProgress).not.toHaveBeenCalled();
  });

  it('loads saved progress and degrades read failures to null', async () => {
    mocks.loadSavedQuizProgress.mockResolvedValueOnce(progress).mockRejectedValueOnce(new Error());
    const { result } = renderHook(() => useQuizProgress({ slug: 'quiz-1', enabled: true }));

    await expect(result.current.loadProgress()).resolves.toBe(progress);
    await expect(result.current.loadProgress()).resolves.toBeNull();
    expect(mocks.loadSavedQuizProgress).toHaveBeenNthCalledWith(1, 'quiz-1');
  });

  it('debounces writes and persists only the latest payload', async () => {
    mocks.saveQuizProgress.mockResolvedValue(undefined);
    const latest = { ...progress, currentQuestionIndex: 1 } satisfies SavedQuizProgress;
    const { result } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => {
      result.current.saveProgress(progress);
      result.current.saveProgress(latest);
    });
    await act(async () => vi.advanceTimersByTimeAsync(49));
    expect(mocks.saveQuizProgress).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.saveQuizProgress).toHaveBeenCalledTimes(1);
    expect(mocks.saveQuizProgress).toHaveBeenCalledWith(
      'quiz-1',
      latest,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('flushes immediately and clears a pending save before deleting', async () => {
    mocks.saveQuizProgress.mockResolvedValue(undefined);
    mocks.deleteSavedQuizProgress.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => result.current.saveProgress(progress));
    await act(async () => result.current.flushSave());
    expect(mocks.saveQuizProgress).toHaveBeenCalledWith(
      'quiz-1',
      progress,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    act(() => result.current.saveProgress(progress));
    await act(async () => result.current.clearProgress());
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(mocks.saveQuizProgress).toHaveBeenCalledTimes(1);
    expect(mocks.deleteSavedQuizProgress).toHaveBeenCalledWith('quiz-1');
  });

  it('swallows best-effort persistence errors', async () => {
    mocks.saveQuizProgress.mockRejectedValueOnce(new Error('save failed'));
    mocks.deleteSavedQuizProgress.mockRejectedValueOnce(new Error('delete failed'));
    const { result } = renderHook(() => useQuizProgress({ slug: 'quiz-1', enabled: true }));

    act(() => result.current.saveProgress(progress));
    await expect(result.current.flushSave()).resolves.toBeUndefined();
    await expect(result.current.clearProgress()).resolves.toBeUndefined();
  });

  it('does not persist a pending payload after the hook becomes disabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useQuizProgress({ slug: 'quiz-1', enabled, debounceMs: 50 }),
      { initialProps: { enabled: true } },
    );

    act(() => result.current.saveProgress(progress));
    rerender({ enabled: false });
    await act(async () => vi.advanceTimersByTimeAsync(50));

    expect(mocks.saveQuizProgress).not.toHaveBeenCalled();
  });

  it('flushes pending progress with keepalive on unmount', async () => {
    mocks.saveQuizProgress.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => result.current.saveProgress(progress));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(mocks.saveQuizProgress).toHaveBeenCalledWith('quiz-1', progress, { keepalive: true });
  });

  it('does not flush on unmount after clearProgress invalidates pending work', async () => {
    mocks.deleteSavedQuizProgress.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => result.current.saveProgress(progress));
    await act(async () => result.current.clearProgress());
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(50));

    expect(mocks.saveQuizProgress).not.toHaveBeenCalled();
    expect(mocks.deleteSavedQuizProgress).toHaveBeenCalledWith('quiz-1');
  });

  it('aborts an in-flight save when clearProgress runs (submit race guard)', async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    const signals: AbortSignal[] = [];
    mocks.saveQuizProgress.mockImplementation(
      (_slug: string, _payload: SavedQuizProgress, options?: { signal?: AbortSignal }) => {
        if (options?.signal) {
          signals.push(options.signal);
        }
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      },
    );
    mocks.deleteSavedQuizProgress.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => result.current.saveProgress(progress));
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(mocks.saveQuizProgress).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    await act(async () => result.current.clearProgress());
    expect(signals[0]?.aborted).toBe(true);

    resolveSave?.({ saved: true });
    await act(async () => undefined);

    // clearProgress must not allow a second write after invalidation.
    act(() => result.current.saveProgress(progress));
    await act(async () => result.current.clearProgress());
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(mocks.saveQuizProgress).toHaveBeenCalledTimes(1);
  });

  it('returns without writing when there is no pending payload', async () => {
    const { result } = renderHook(() => useQuizProgress({ slug: 'quiz-1', enabled: true }));

    await act(async () => result.current.flushSave());

    expect(mocks.saveQuizProgress).not.toHaveBeenCalled();
  });

  it('uses the latest enabled flag, slug, and debounce duration after rerender', async () => {
    mocks.loadSavedQuizProgress.mockResolvedValue(progress);
    mocks.saveQuizProgress.mockResolvedValue(undefined);
    mocks.deleteSavedQuizProgress.mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ slug, enabled, debounceMs }) => useQuizProgress({ slug, enabled, debounceMs }),
      { initialProps: { slug: 'quiz-old', enabled: false, debounceMs: 100 } },
    );

    rerender({ slug: 'quiz-new', enabled: true, debounceMs: 25 });
    await expect(result.current.loadProgress()).resolves.toBe(progress);
    act(() => result.current.saveProgress(progress));
    await act(async () => vi.advanceTimersByTimeAsync(25));
    await act(async () => result.current.clearProgress());

    expect(mocks.loadSavedQuizProgress).toHaveBeenCalledWith('quiz-new');
    expect(mocks.saveQuizProgress).toHaveBeenCalledWith(
      'quiz-new',
      progress,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.deleteSavedQuizProgress).toHaveBeenCalledWith('quiz-new');
  });

  it('cancels an existing timer when flushing and replacing pending work', async () => {
    mocks.saveQuizProgress.mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result } = renderHook(() =>
      useQuizProgress({ slug: 'quiz-1', enabled: true, debounceMs: 50 }),
    );

    act(() => result.current.saveProgress(progress));
    await act(async () => result.current.flushSave());
    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      result.current.saveProgress(progress);
      result.current.saveProgress({ ...progress, currentQuestionIndex: 1 });
    });
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });
});
