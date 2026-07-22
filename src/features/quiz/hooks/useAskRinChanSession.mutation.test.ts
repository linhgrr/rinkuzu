/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  getConversation: vi.fn(),
  registerContext: vi.fn(),
  stream: vi.fn(),
}));

vi.mock('@/lib/ask-rin-chan/client', () => ({
  deleteAskRinConversation: mocks.deleteConversation,
  getAskRinConversation: mocks.getConversation,
  registerAskRinContext: mocks.registerContext,
  streamAskRinChan: mocks.stream,
}));

import { useAskRinChanSession } from './useAskRinChanSession';

const credentials = {
  exerciseContextId: 'quiz:context',
  exerciseContextToken: 'context-token-with-at-least-thirty-two-characters',
};

describe('useAskRinChanSession mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerContext.mockResolvedValue(credentials);
    mocks.getConversation.mockResolvedValue(null);
    mocks.deleteConversation.mockResolvedValue(true);
    mocks.stream.mockResolvedValue('answer');
  });

  it('surfaces registration failures and permits a later retry', async () => {
    mocks.registerContext.mockRejectedValueOnce(new Error('Context unavailable'));
    const { result } = renderHook(() => useAskRinChanSession());
    const payload = { question: 'Q?', options: [] };

    act(() => result.current.ensureHistory('q', payload));
    await waitFor(() => expect(result.current.aiError).toBe('Context unavailable'));

    act(() => result.current.ensureHistory('q', payload));
    await waitFor(() => expect(mocks.getConversation).toHaveBeenCalledOnce());
    expect(mocks.registerContext).toHaveBeenCalledTimes(2);
  });

  it('refreshes authoritative history after a failed stream', async () => {
    mocks.stream.mockRejectedValue(new Error('Network interrupted'));
    mocks.getConversation.mockResolvedValueOnce(null).mockResolvedValueOnce({
      conversationId: 'conversation',
      exerciseContextId: credentials.exerciseContextId,
      messages: [
        {
          messageId: 'partial',
          role: 'assistant',
          content: 'Partial answer',
          status: 'interrupted',
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
    });
    const { result } = renderHook(() => useAskRinChanSession());
    act(() => result.current.setUserQuestion('Explain'));

    await act(async () => {
      await result.current.sendMessage({
        historyKey: 'q',
        payload: { question: 'Q?', options: [] },
      });
    });

    expect(result.current.aiError).toBe('Network interrupted');
    expect(result.current.getHistory('q')[0]?.content).toBe('Partial answer');
    expect(result.current.loadingAI).toBe(false);
  });

  it('aborts the active stream without showing an error', async () => {
    mocks.stream.mockImplementation(
      (_payload, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const { result } = renderHook(() => useAskRinChanSession());
    act(() => result.current.setUserQuestion('Explain'));
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current.sendMessage({
        historyKey: 'q',
        payload: { question: 'Q?', options: [] },
      });
    });
    await waitFor(() => expect(result.current.loadingAI).toBe(true));

    act(() => result.current.cancelActiveStream());
    await act(async () => pending);

    expect(result.current.aiError).toBe('');
    expect(result.current.loadingAI).toBe(false);
  });

  it('deletes a known conversation when its local key is removed', async () => {
    const { result } = renderHook(() => useAskRinChanSession());
    act(() => result.current.ensureHistory('q', { question: 'Q?', options: [] }));
    await waitFor(() => expect(mocks.getConversation).toHaveBeenCalledOnce());

    act(() => result.current.removeHistory('q'));
    await waitFor(() =>
      expect(mocks.deleteConversation).toHaveBeenCalledWith(credentials.exerciseContextId),
    );
    expect(result.current.getHistory('q')).toEqual([]);
  });
});
