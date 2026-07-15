/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('useStreamingChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readChatHistories.mockReturnValue({});
  });

  it('omits absent media and keeps complete messages while streaming', async () => {
    mocks.streamQuizAI.mockImplementation(async (_payload, options) => {
      options.onContent('partial', 'partial answer');
      return 'final answer';
    });
    const { result } = renderHook(() => useStreamingChatSession());

    act(() => result.current.setUserQuestion('  Why?  '));
    await act(async () =>
      result.current.sendMessage({
        historyKey: 'question-1',
        payload: { question: 'What is 2 + 2?', options: ['3', '4'] },
      }),
    );

    expect(mocks.streamQuizAI).toHaveBeenCalledWith(
      {
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        userQuestion: 'Why?',
        chatHistory: [],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal), onContent: expect.any(Function) }),
    );
    expect(result.current.getHistory('question-1')).toEqual([
      expect.objectContaining({ role: 'user', content: 'Why?', timestamp: expect.any(String) }),
      expect.objectContaining({
        role: 'assistant',
        content: 'final answer',
        timestamp: expect.any(String),
      }),
    ]);
  });
});
