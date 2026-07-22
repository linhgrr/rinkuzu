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
  exerciseContextId: 'quiz:context-1',
  exerciseContextToken: 'context-token-with-at-least-thirty-two-characters',
};

describe('useAskRinChanSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.registerContext.mockResolvedValue(credentials);
    mocks.getConversation.mockResolvedValue(null);
    mocks.deleteConversation.mockResolvedValue(true);
    mocks.stream.mockResolvedValue('final answer');
  });

  it('loads server-owned history and removes the legacy browser copy', async () => {
    localStorage.setItem('quiz_chat_history:v1:attempt:old', '{}');
    mocks.getConversation.mockResolvedValue({
      conversationId: 'conversation-1',
      exerciseContextId: credentials.exerciseContextId,
      messages: [
        {
          messageId: 'message-1',
          role: 'assistant',
          content: 'Saved answer',
          status: 'complete',
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
    });
    const { result } = renderHook(() => useAskRinChanSession());

    act(() => {
      result.current.ensureHistory('q1', { question: 'Question?', options: ['A', 'B'] });
    });

    await waitFor(() => expect(result.current.getHistory('q1')).toHaveLength(1));
    expect(localStorage.getItem('quiz_chat_history:v1:attempt:old')).toBeNull();
    expect(mocks.registerContext).toHaveBeenCalledWith({
      source: 'quiz',
      question: 'Question?',
      options: ['A', 'B'],
      optionImages: [],
    });
  });

  it('streams through one Ask Rin-chan API with an idempotency key', async () => {
    mocks.stream.mockImplementation(async (_payload, options) => {
      options.onContent('partial', 'partial answer');
      return 'final answer';
    });
    const { result } = renderHook(() => useAskRinChanSession());

    act(() => result.current.setUserQuestion('  Why?  '));
    let sent = false;
    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 'q1',
        payload: { question: 'What is 2 + 2?', options: ['3', '4'] },
      });
    });

    expect(sent).toBe(true);
    expect(mocks.stream).toHaveBeenCalledWith(
      {
        exerciseContextToken: credentials.exerciseContextToken,
        message: 'Why?',
        clientRequestId: expect.any(String),
      },
      expect.objectContaining({ signal: expect.any(AbortSignal), onContent: expect.any(Function) }),
    );
    expect(result.current.getHistory('q1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'Why?' }),
      expect.objectContaining({ role: 'assistant', content: 'final answer' }),
    ]);
    expect(result.current.totalTurns).toBe(1);
  });

  it('deduplicates concurrent context registration for the same exercise', async () => {
    let resolveRegistration: (value: typeof credentials) => void = () => undefined;
    mocks.registerContext.mockReturnValue(
      new Promise<typeof credentials>((resolve) => {
        resolveRegistration = resolve;
      }),
    );
    const { result } = renderHook(() => useAskRinChanSession());
    const payload = { question: 'Question?', options: ['A'] };

    act(() => {
      result.current.ensureHistory('q1', payload);
      result.current.ensureHistory('q1', payload);
    });
    expect(mocks.registerContext).toHaveBeenCalledOnce();

    resolveRegistration(credentials);
    await waitFor(() => expect(mocks.getConversation).toHaveBeenCalledOnce());
  });

  it('rejects blank messages before creating context or consuming quota', async () => {
    const { result } = renderHook(() => useAskRinChanSession());
    let sent = true;
    await act(async () => {
      sent = await result.current.sendMessage({
        historyKey: 'q1',
        payload: { question: 'Question?', options: [] },
        emptyQuestionErrorMessage: 'Write a question first',
      });
    });

    expect(sent).toBe(false);
    expect(result.current.aiError).toBe('Write a question first');
    expect(mocks.registerContext).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('clears server history and restores it when deletion fails', async () => {
    mocks.getConversation.mockResolvedValue({
      conversationId: 'conversation-1',
      exerciseContextId: credentials.exerciseContextId,
      messages: [
        {
          messageId: 'message-1',
          role: 'user',
          content: 'Keep me',
          status: 'complete',
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
    });
    mocks.deleteConversation.mockRejectedValue(new Error('Delete failed'));
    const { result } = renderHook(() => useAskRinChanSession());
    act(() => result.current.ensureHistory('q1', { question: 'Question?', options: [] }));
    await waitFor(() => expect(result.current.getHistory('q1')).toHaveLength(1));

    await act(async () => result.current.clearHistory('q1'));

    expect(result.current.aiError).toBe('Delete failed');
    expect(result.current.getHistory('q1')[0]?.content).toBe('Keep me');
  });
});
