import { beforeEach, describe, expect, it, vi } from 'vitest';

const { consumeOpenAISseResponseMock } = vi.hoisted(() => ({
  consumeOpenAISseResponseMock: vi.fn(),
}));

vi.mock('@/lib/ai/stream', () => ({
  consumeOpenAISseResponse: consumeOpenAISseResponseMock,
}));

import { streamQuizAI } from '@/lib/quiz/ask-ai';

describe('streamQuizAI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    consumeOpenAISseResponseMock.mockReset().mockResolvedValue('AI response');
  });

  it('omits absent optional fetch and stream callbacks', async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(
      streamQuizAI({
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        userQuestion: 'Explain question 1',
      }),
    ).resolves.toBe('AI response');

    expect(fetchMock).toHaveBeenCalledWith('/api/quiz/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        userQuestion: 'Explain question 1',
        questionImage: null,
        stream: true,
      }),
    });
    expect(consumeOpenAISseResponseMock).toHaveBeenCalledWith(response, {
      extractErrorMessage: expect.any(Function),
    });
  });
});
