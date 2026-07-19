/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useQuizAIExplain } from './useQuizAIExplain';

const mocks = vi.hoisted(() => ({
  promptUpgrade: vi.fn(),
  streamQuizAI: vi.fn(),
}));

vi.mock('@/features/subscription/lib/upgrade-prompt-context', () => ({
  useUpgradePrompt: () => ({ promptUpgrade: mocks.promptUpgrade }),
}));

vi.mock('@/lib/quiz/ask-ai', () => ({
  streamQuizAI: mocks.streamQuizAI,
}));

const question = {
  question: 'What is a race condition?',
  options: ['A', 'B'],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useQuizAIExplain', () => {
  it('starts closed and resets modal state after a previous failure', async () => {
    mocks.streamQuizAI.mockRejectedValueOnce(new Error('network failed'));
    const { result } = renderHook(() => useQuizAIExplain());

    expect(result.current).toMatchObject({
      showAIModal: false,
      aiExplanation: '',
      userQuestion: '',
      loadingAI: false,
      aiError: '',
    });

    act(() => result.current.setUserQuestion('why?'));
    await act(async () => result.current.askAI(question));
    expect(result.current.aiError).toBe('network failed');

    act(() => result.current.openAIModal());
    expect(result.current).toMatchObject({
      showAIModal: true,
      aiExplanation: '',
      userQuestion: '',
      loadingAI: false,
      aiError: '',
    });
  });

  it('streams content and settles with the final explanation', async () => {
    mocks.streamQuizAI.mockImplementationOnce(async (_payload, options) => {
      options.onContent('partial', 'partial explanation');
      return 'final explanation';
    });
    const { result } = renderHook(() => useQuizAIExplain());

    await act(async () => result.current.askAI(question));

    expect(result.current.aiExplanation).toBe('final explanation');
    expect(result.current.loadingAI).toBe(false);
    expect(result.current.aiError).toBe('');
  });

  it('publishes partial content only while the request owns the stream', async () => {
    const pending = deferred<string>();
    let publish!: (delta: string, fullContent: string) => void;
    mocks.streamQuizAI.mockImplementationOnce((_payload, options) => {
      publish = options.onContent;
      return pending.promise;
    });
    const { result } = renderHook(() => useQuizAIExplain());
    let request!: Promise<void>;
    act(() => {
      request = result.current.askAI(question);
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(1));

    act(() => publish('partial', 'partial explanation'));
    expect(result.current.aiExplanation).toBe('partial explanation');
    expect(result.current.loadingAI).toBe(true);

    pending.resolve('final explanation');
    await act(async () => request);
    expect(result.current.aiExplanation).toBe('final explanation');
    expect(result.current.loadingAI).toBe(false);
  });

  it('ignores content callbacks from an older stream', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const publishers: Array<(delta: string, fullContent: string) => void> = [];
    mocks.streamQuizAI
      .mockImplementationOnce((_payload, options) => {
        publishers.push(options.onContent);
        return first.promise;
      })
      .mockImplementationOnce((_payload, options) => {
        publishers.push(options.onContent);
        return second.promise;
      });
    const { result } = renderHook(() => useQuizAIExplain());
    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.askAI({ ...question, question: 'first' });
    });
    await waitFor(() => expect(publishers).toHaveLength(1));
    let secondRequest!: Promise<void>;
    act(() => {
      secondRequest = result.current.askAI({ ...question, question: 'second' });
    });
    await waitFor(() => expect(publishers).toHaveLength(2));

    act(() => {
      publishers[0]?.('old', 'stale partial');
      publishers[1]?.('new', 'current partial');
    });
    expect(result.current.aiExplanation).toBe('current partial');

    first.resolve('stale final');
    second.resolve('current final');
    await act(async () => Promise.all([firstRequest, secondRequest]));
    expect(result.current.aiExplanation).toBe('current final');
  });

  it('normalizes an optional user question and forwards image context', async () => {
    mocks.streamQuizAI.mockResolvedValueOnce('answer');
    const { result } = renderHook(() => useQuizAIExplain());

    act(() => result.current.setUserQuestion('  explain why  '));
    await act(async () =>
      result.current.askAI({
        ...question,
        questionImage: 'question.png',
        optionImages: ['a.png', undefined],
      }),
    );

    expect(mocks.streamQuizAI).toHaveBeenCalledWith(
      {
        ...question,
        userQuestion: 'explain why',
        questionImage: 'question.png',
        optionImages: ['a.png', undefined],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal), onContent: expect.any(Function) }),
    );
  });

  it('does not let an aborted stale request settle a newer request', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mocks.streamQuizAI.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useQuizAIExplain());

    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.askAI({ ...question, question: 'first' });
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(1));
    const firstSignal = mocks.streamQuizAI.mock.calls[0]?.[1].signal;

    let secondRequest!: Promise<void>;
    act(() => {
      secondRequest = result.current.askAI({ ...question, question: 'second' });
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);

    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    first.reject(aborted);
    await act(async () => firstRequest);
    expect(result.current.loadingAI).toBe(true);
    expect(result.current.aiExplanation).toBe('');

    second.resolve('newest explanation');
    await act(async () => secondRequest);
    expect(result.current.loadingAI).toBe(false);
    expect(result.current.aiExplanation).toBe('newest explanation');
  });

  it('prompts an upgrade for premium limits and exposes an error', async () => {
    mocks.streamQuizAI.mockRejectedValueOnce({ code: 'premium_required' });
    const { result } = renderHook(() => useQuizAIExplain());

    await act(async () => result.current.askAI(question));

    expect(mocks.promptUpgrade).toHaveBeenCalledWith('rate_limit');
    expect(result.current.aiError).toBeTruthy();
    expect(result.current.loadingAI).toBe(false);
  });

  it('treats an active abort as cancellation instead of a user-facing error', async () => {
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    mocks.streamQuizAI.mockRejectedValueOnce(aborted);
    const { result } = renderHook(() => useQuizAIExplain());

    await act(async () => result.current.askAI(question));

    expect(result.current.aiError).toBe('');
    expect(result.current.loadingAI).toBe(false);
    expect(mocks.promptUpgrade).not.toHaveBeenCalled();
  });

  it('ignores a stale successful response after a newer request owns the state', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mocks.streamQuizAI.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useQuizAIExplain());

    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.askAI({ ...question, question: 'first' });
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(1));
    let secondRequest!: Promise<void>;
    act(() => {
      secondRequest = result.current.askAI({ ...question, question: 'second' });
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(2));

    first.resolve('stale answer');
    await act(async () => firstRequest);
    expect(result.current.aiExplanation).toBe('');
    expect(result.current.loadingAI).toBe(true);

    second.resolve('current answer');
    await act(async () => secondRequest);
    expect(result.current.aiExplanation).toBe('current answer');
  });

  it('aborts the active request when the modal closes', async () => {
    const pending = deferred<string>();
    mocks.streamQuizAI.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useQuizAIExplain());

    act(() => result.current.openAIModal());
    let request!: Promise<void>;
    act(() => {
      request = result.current.askAI(question);
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(1));
    const signal = mocks.streamQuizAI.mock.calls[0]?.[1].signal;

    act(() => result.current.closeAIModal());
    expect(signal?.aborted).toBe(true);
    expect(result.current.showAIModal).toBe(false);
    expect(result.current.loadingAI).toBe(false);

    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    pending.reject(aborted);
    await act(async () => request);
    expect(result.current.aiError).toBe('');
  });

  it('aborts the active request during unmount cleanup', async () => {
    const pending = deferred<string>();
    mocks.streamQuizAI.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useQuizAIExplain());
    let request!: Promise<void>;
    act(() => {
      request = result.current.askAI(question);
    });
    await waitFor(() => expect(mocks.streamQuizAI).toHaveBeenCalledTimes(1));
    const signal = mocks.streamQuizAI.mock.calls[0]?.[1].signal;

    unmount();
    expect(signal?.aborted).toBe(true);

    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    pending.reject(aborted);
    await act(async () => request);
    expect(mocks.promptUpgrade).not.toHaveBeenCalled();
  });
});
