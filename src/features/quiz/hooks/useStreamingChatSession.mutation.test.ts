/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readChatHistories: vi.fn(),
  streamQuizAI: vi.fn(),
  writeChatHistories: vi.fn(),
}));

vi.mock('@/lib/quiz/ask-ai', () => ({ streamQuizAI: mocks.streamQuizAI }));
vi.mock('@/features/quiz/lib/chat-history-storage', () => ({
  readChatHistories: mocks.readChatHistories,
  writeChatHistories: mocks.writeChatHistories,
}));

import { useStreamingChatSession } from '@/features/quiz/hooks/useStreamingChatSession';

describe('useStreamingChatSession mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readChatHistories.mockReturnValue({});
    mocks.streamQuizAI.mockResolvedValue('assistant reply');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hydrates attempt and bookmarks persistence and writes after hydration', async () => {
    mocks.readChatHistories.mockReturnValue({
      'q-1': [
        {
          role: 'user',
          content: 'prior',
          timestamp: '2026-07-01T00:00:00.000Z',
        },
      ],
    });

    type PersistenceProp = { scope: 'attempt'; id: string } | { scope: 'bookmarks' } | undefined;

    const { result, rerender, unmount } = renderHook(
      ({ persistence }: { persistence: PersistenceProp }) =>
        useStreamingChatSession(persistence ? { persistence } : {}),
      {
        initialProps: {
          persistence: { scope: 'attempt' as const, id: 'attempt-1' } as PersistenceProp,
        },
      },
    );

    await waitFor(() => {
      expect(mocks.readChatHistories).toHaveBeenCalledWith({
        scope: 'attempt',
        id: 'attempt-1',
      });
      expect(result.current.getHistory('q-1')).toEqual([
        {
          role: 'user',
          content: 'prior',
          timestamp: '2026-07-01T00:00:00.000Z',
        },
      ]);
    });

    await waitFor(() => {
      expect(mocks.writeChatHistories).toHaveBeenCalledWith(
        { scope: 'attempt', id: 'attempt-1' },
        expect.objectContaining({
          'q-1': [
            {
              role: 'user',
              content: 'prior',
              timestamp: '2026-07-01T00:00:00.000Z',
            },
          ],
        }),
      );
    });

    mocks.readChatHistories.mockReturnValue({
      b1: [
        {
          role: 'assistant',
          content: 'bookmarked',
          timestamp: '2026-07-02T00:00:00.000Z',
        },
      ],
    });
    rerender({ persistence: { scope: 'bookmarks' } });

    await waitFor(() => {
      expect(mocks.readChatHistories).toHaveBeenCalledWith({ scope: 'bookmarks' });
      expect(result.current.getHistory('b1')[0]?.content).toBe('bookmarked');
    });

    unmount();
  });

  it('does not read or write storage without persistence', async () => {
    const { result } = renderHook(() => useStreamingChatSession());

    expect(mocks.readChatHistories).not.toHaveBeenCalled();
    act(() => {
      result.current.ensureHistory('q');
    });
    expect(mocks.writeChatHistories).not.toHaveBeenCalled();
  });

  it('rejects empty questions with default and custom messages', async () => {
    const { result } = renderHook(() => useStreamingChatSession());

    let sent = true;
    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 'q1',
        payload: { question: 'Q?', options: ['A'] },
      });
    });
    expect(sent).toBe(false);
    expect(result.current.aiError).toBe('Please enter a question!');
    expect(mocks.streamQuizAI).not.toHaveBeenCalled();

    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 'q1',
        payload: { question: 'Q?', options: ['A'] },
        emptyQuestionErrorMessage: 'Custom empty',
      });
    });
    expect(sent).toBe(false);
    expect(result.current.aiError).toBe('Custom empty');
  });

  it('trims user question, streams media fields, clears input, and returns true', async () => {
    mocks.streamQuizAI.mockImplementation(async (_payload, options) => {
      options.onContent('part', 'partial content');
      return 'final content';
    });
    const { result } = renderHook(() => useStreamingChatSession());

    act(() => {
      result.current.setUserQuestion('  Explain this  ');
    });
    expect(result.current.userQuestion).toBe('  Explain this  ');

    let sent = false;
    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 42,
        payload: {
          question: 'What?',
          options: ['1', '2'],
          questionImage: 'https://img/q.png',
          optionImages: ['https://img/a.png', undefined],
        },
      });
    });

    expect(sent).toBe(true);
    expect(result.current.userQuestion).toBe('');
    expect(result.current.loadingAI).toBe(false);
    expect(result.current.aiError).toBe('');
    expect(mocks.streamQuizAI).toHaveBeenCalledWith(
      {
        question: 'What?',
        options: ['1', '2'],
        userQuestion: 'Explain this',
        questionImage: 'https://img/q.png',
        optionImages: ['https://img/a.png', undefined],
        chatHistory: [],
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onContent: expect.any(Function),
      }),
    );
    expect(result.current.getHistory(42)).toEqual([
      expect.objectContaining({ role: 'user', content: 'Explain this' }),
      expect.objectContaining({ role: 'assistant', content: 'final content' }),
    ]);
    expect(result.current.totalTurns).toBe(1);
  });

  it('omits optional media fields when undefined', async () => {
    const { result } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setUserQuestion('Why?');
    });

    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'q-media',
        payload: { question: 'Q', options: ['A'] },
      });
    });

    const payload = mocks.streamQuizAI.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('questionImage');
    expect(payload).not.toHaveProperty('optionImages');
  });

  it('maps request failures to extracted, custom, or default error messages and drops empty assistant placeholder', async () => {
    const { result } = renderHook(() => useStreamingChatSession());

    act(() => {
      result.current.setUserQuestion('Q1');
    });
    mocks.streamQuizAI.mockRejectedValueOnce(new Error('  upstream blew up  '));
    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'err-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    expect(result.current.aiError).toBe('upstream blew up');
    expect(result.current.getHistory('err-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'Q1' }),
    ]);
    expect(result.current.loadingAI).toBe(false);

    act(() => {
      result.current.setUserQuestion('Q2');
    });
    mocks.streamQuizAI.mockRejectedValueOnce(new Error('   '));
    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'err-2',
        payload: { question: 'Q', options: ['A'] },
        requestErrorMessage: 'Custom request failure',
      });
    });
    expect(result.current.aiError).toBe('Custom request failure');

    act(() => {
      result.current.setUserQuestion('Q3');
    });
    mocks.streamQuizAI.mockRejectedValueOnce('not-an-error');
    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'err-3',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    expect(result.current.aiError).toBe('Failed to connect to AI service. Please try again.');
  });

  it('treats AbortError as a silent cancellation that preserves user turn and clears aiError', async () => {
    const { result } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setUserQuestion('Abort me');
      result.current.setAIError('stale');
    });
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mocks.streamQuizAI.mockRejectedValueOnce(abortError);

    let sent = true;
    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 'abort-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });

    expect(sent).toBe(false);
    expect(result.current.aiError).toBe('');
    expect(result.current.getHistory('abort-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'Abort me' }),
    ]);
  });

  it('cancelActiveStream aborts the in-flight request and clears loading', async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveStream: ((value: string) => void) | undefined;
    mocks.streamQuizAI.mockImplementation((_payload, options) => {
      capturedSignal = options.signal as AbortSignal;
      return new Promise<string>((resolve) => {
        resolveStream = resolve;
      });
    });

    const { result } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setUserQuestion('slow');
    });

    let sendPromise: Promise<boolean> | undefined;
    act(() => {
      sendPromise = result.current.sendMessage({
        historyKey: 'slow-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });

    await waitFor(() => {
      expect(result.current.loadingAI).toBe(true);
      expect(capturedSignal).toBeDefined();
    });

    act(() => {
      result.current.cancelActiveStream();
    });
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loadingAI).toBe(false);

    await act(async () => {
      resolveStream?.('late');
      await sendPromise;
    });
  });

  it('aborts previous stream when a new message starts', async () => {
    const signals: AbortSignal[] = [];
    mocks.streamQuizAI.mockImplementation((_payload, options) => {
      signals.push(options.signal as AbortSignal);
      return new Promise<string>(() => {
        // intentionally pending
      });
    });

    const { result } = renderHook(() => useStreamingChatSession());

    act(() => {
      result.current.setUserQuestion('first');
    });
    act(() => {
      void result.current.sendMessage({
        historyKey: 'h1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(signals).toHaveLength(1));

    act(() => {
      result.current.setUserQuestion('second');
    });
    act(() => {
      void result.current.sendMessage({
        historyKey: 'h1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);
  });

  it('overlapping streams: aborted A cannot clear B loading, controller, or placeholder', async () => {
    type StreamHandle = {
      signal: AbortSignal;
      onContent: (partial: string, full: string) => void;
      reject: (error: unknown) => void;
      resolve: (value: string) => void;
    };
    const streams: StreamHandle[] = [];

    mocks.streamQuizAI.mockImplementation((_payload, options) => {
      return new Promise<string>((resolve, reject) => {
        streams.push({
          signal: options.signal as AbortSignal,
          onContent: options.onContent,
          reject,
          resolve,
        });
      });
    });

    const { result } = renderHook(() => useStreamingChatSession());

    act(() => {
      result.current.setUserQuestion('first');
    });
    let sendA: Promise<boolean> | undefined;
    act(() => {
      sendA = result.current.sendMessage({
        historyKey: 'overlap-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(result.current.loadingAI).toBe(true);

    act(() => {
      result.current.setUserQuestion('second');
    });
    let sendB: Promise<boolean> | undefined;
    act(() => {
      sendB = result.current.sendMessage({
        historyKey: 'overlap-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(streams).toHaveLength(2));

    const streamA = streams[0];
    const streamB = streams[1];
    expect(streamA).toBeDefined();
    expect(streamB).toBeDefined();
    if (!streamA || !streamB) {
      throw new Error('expected both overlapping streams to be captured');
    }
    expect(streamA.signal.aborted).toBe(true);
    expect(streamB.signal.aborted).toBe(false);
    expect(result.current.loadingAI).toBe(true);

    // A rejects AbortError after B already owns the session.
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    let resultA = true;
    await act(async () => {
      streamA.reject(abortError);
      if (!sendA) {
        throw new Error('expected sendA promise');
      }
      resultA = await sendA;
    });

    expect(resultA).toBe(false);
    // B must remain active; A must not pop B's empty assistant or clear loading.
    expect(result.current.loadingAI).toBe(true);
    expect(result.current.aiError).toBe('');
    expect(result.current.getHistory('overlap-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'first' }),
      expect.objectContaining({ role: 'user', content: 'second' }),
      expect.objectContaining({ role: 'assistant', content: '' }),
    ]);

    // B can still deliver content.
    await act(async () => {
      streamB.onContent('chunk', 'from B');
    });
    expect(result.current.getHistory('overlap-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'first' }),
      expect.objectContaining({ role: 'user', content: 'second' }),
      expect.objectContaining({ role: 'assistant', content: 'from B' }),
    ]);

    let resultB = false;
    await act(async () => {
      streamB.resolve('final from B');
      if (!sendB) {
        throw new Error('expected sendB promise');
      }
      resultB = await sendB;
    });

    expect(resultB).toBe(true);
    expect(result.current.loadingAI).toBe(false);
    expect(result.current.userQuestion).toBe('');
    expect(result.current.getHistory('overlap-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'first' }),
      expect.objectContaining({ role: 'user', content: 'second' }),
      expect.objectContaining({ role: 'assistant', content: 'final from B' }),
    ]);
  });

  it('overlapping streams: A AbortError leaves B cancellable and cannot overwrite B history', async () => {
    type StreamHandle = {
      signal: AbortSignal;
      onContent: (partial: string, full: string) => void;
      reject: (error: unknown) => void;
      resolve: (value: string) => void;
    };
    const streams: StreamHandle[] = [];

    mocks.streamQuizAI.mockImplementation((_payload, options) => {
      return new Promise<string>((resolve, reject) => {
        streams.push({
          signal: options.signal as AbortSignal,
          onContent: options.onContent,
          reject,
          resolve,
        });
      });
    });

    const { result } = renderHook(() => useStreamingChatSession());

    act(() => {
      result.current.setUserQuestion('stream-a');
    });
    let sendA: Promise<boolean> | undefined;
    act(() => {
      sendA = result.current.sendMessage({
        historyKey: 'overlap-2',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(streams).toHaveLength(1));

    act(() => {
      result.current.setUserQuestion('stream-b');
    });
    let sendB: Promise<boolean> | undefined;
    act(() => {
      sendB = result.current.sendMessage({
        historyKey: 'overlap-2',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(streams).toHaveLength(2));

    const streamA = streams[0];
    const streamB = streams[1];
    expect(streamA).toBeDefined();
    expect(streamB).toBeDefined();
    if (!streamA || !streamB) {
      throw new Error('expected both overlapping streams to be captured');
    }

    // Late content from A must not overwrite B's placeholder.
    await act(async () => {
      streamA.onContent('stale', 'stale from A');
    });
    expect(result.current.getHistory('overlap-2').at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: '' }),
    );

    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    await act(async () => {
      streamA.reject(abortError);
      await sendA;
    });

    expect(result.current.loadingAI).toBe(true);
    expect(result.current.getHistory('overlap-2')).toEqual([
      expect.objectContaining({ role: 'user', content: 'stream-a' }),
      expect.objectContaining({ role: 'user', content: 'stream-b' }),
      expect.objectContaining({ role: 'assistant', content: '' }),
    ]);

    // B remains cancellable as the active stream.
    act(() => {
      result.current.cancelActiveStream();
    });
    expect(streamB.signal.aborted).toBe(true);
    expect(result.current.loadingAI).toBe(false);

    const abortB = new Error('Aborted');
    abortB.name = 'AbortError';
    let resultB = true;
    await act(async () => {
      streamB.reject(abortB);
      if (!sendB) {
        throw new Error('expected sendB promise');
      }
      resultB = await sendB;
    });

    expect(resultB).toBe(false);
    expect(result.current.loadingAI).toBe(false);
    expect(result.current.aiError).toBe('');
    // User turns preserved; both empty assistants removed (A via supersede cleanup, B via cancel).
    expect(result.current.getHistory('overlap-2')).toEqual([
      expect.objectContaining({ role: 'user', content: 'stream-a' }),
      expect.objectContaining({ role: 'user', content: 'stream-b' }),
    ]);
  });
  it('ensureHistory, clearHistory, removeHistory, getHistory, and totalTurns behave exactly', async () => {
    const { result } = renderHook(() => useStreamingChatSession());

    expect(result.current.getHistory('missing')).toEqual([]);
    expect(result.current.getHistory('missing')).toBe(result.current.getHistory('missing'));

    act(() => {
      result.current.ensureHistory('k1');
      result.current.ensureHistory('k1');
    });
    expect(result.current.getHistory('k1')).toEqual([]);
    expect(result.current.chatHistories).toHaveProperty('k1');

    act(() => {
      result.current.setUserQuestion('one');
    });
    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'k1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    act(() => {
      result.current.setUserQuestion('two');
    });
    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'k2',
        payload: { question: 'Q2', options: ['B'] },
      });
    });
    expect(result.current.totalTurns).toBe(2);

    act(() => {
      result.current.clearHistory('k1');
    });
    expect(result.current.getHistory('k1')).toEqual([]);
    expect(result.current.chatHistories).toHaveProperty('k1');
    expect(result.current.totalTurns).toBe(1);

    act(() => {
      result.current.removeHistory('k2');
      result.current.removeHistory('absent');
    });
    expect(result.current.chatHistories).not.toHaveProperty('k2');
    expect(result.current.totalTurns).toBe(0);
  });

  it('setAIError updates aiError state', () => {
    const { result } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setAIError('manual');
    });
    expect(result.current.aiError).toBe('manual');
  });

  it('unmount aborts any active stream controller', async () => {
    let capturedSignal: AbortSignal | undefined;
    mocks.streamQuizAI.mockImplementation((_payload, options) => {
      capturedSignal = options.signal as AbortSignal;
      return new Promise<string>(() => {
        // pending until unmount abort
      });
    });

    const { result, unmount } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setUserQuestion('pending');
    });
    act(() => {
      void result.current.sendMessage({
        historyKey: 'u1',
        payload: { question: 'Q', options: ['A'] },
      });
    });
    await waitFor(() => expect(capturedSignal).toBeDefined());

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('keeps partial assistant content on error when stream already wrote content', async () => {
    mocks.streamQuizAI.mockImplementation(async (_payload, options) => {
      options.onContent('part', 'partial only');
      throw new Error('mid-stream failure');
    });
    const { result } = renderHook(() => useStreamingChatSession());
    act(() => {
      result.current.setUserQuestion('partial');
    });

    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'partial-1',
        payload: { question: 'Q', options: ['A'] },
      });
    });

    expect(result.current.getHistory('partial-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'partial' }),
      expect.objectContaining({ role: 'assistant', content: 'partial only' }),
    ]);
    expect(result.current.aiError).toBe('mid-stream failure');
  });
});
