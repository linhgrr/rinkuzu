import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeOpenAISseResponse: vi.fn().mockResolvedValue('Tutor answer'),
  extractApiErrorMessage: vi.fn((body: unknown, fallback: string) => `mapped:${fallback}`),
}));

vi.mock('@/lib/ai/stream', () => ({
  consumeOpenAISseResponse: mocks.consumeOpenAISseResponse,
}));

vi.mock('@/lib/api/error', () => ({
  extractApiErrorMessage: mocks.extractApiErrorMessage,
}));

import { streamAdaptiveTutorChat } from '@/lib/adaptive/chat';

describe('streamAdaptiveTutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeOpenAISseResponse.mockResolvedValue('Tutor answer');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it('posts stream=true to the session chat route and forces streaming on', async () => {
    await expect(
      streamAdaptiveTutorChat('session-1', {
        userQuestion: 'Explain this',
        chatHistory: [{ role: 'assistant', content: 'hi' }],
      }),
    ).resolves.toBe('Tutor answer');

    expect(fetch).toHaveBeenCalledWith(
      '/api/adaptive/session/session-1/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuestion: 'Explain this',
          chatHistory: [{ role: 'assistant', content: 'hi' }],
          stream: true,
        }),
      }),
    );
  });

  it('omits absent optional signal and content callback', async () => {
    await streamAdaptiveTutorChat('session-1', { userQuestion: 'Explain this' });

    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).not.toHaveProperty('signal');
    const [, consumeOptions] = mocks.consumeOpenAISseResponse.mock.calls[0] ?? [];
    expect(consumeOptions).not.toHaveProperty('onContent');
    expect(consumeOptions).toEqual(
      expect.objectContaining({
        extractErrorMessage: expect.any(Function),
      }),
    );
  });

  it('forwards signal and onContent when provided and maps HTTP errors through extractApiErrorMessage', async () => {
    const controller = new AbortController();
    const onContent = vi.fn();

    await streamAdaptiveTutorChat(
      'session-42',
      { userQuestion: 'Why?' },
      { signal: controller.signal, onContent },
    );

    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).toMatchObject({
      method: 'POST',
      signal: controller.signal,
    });

    const [response, consumeOptions] = mocks.consumeOpenAISseResponse.mock.calls[0] ?? [];
    expect(response).toBeInstanceOf(Response);
    expect(consumeOptions).toMatchObject({ onContent });

    const mapped = (
      consumeOptions as {
        extractErrorMessage: (body: unknown, status: number) => string;
      }
    ).extractErrorMessage({ error: 'x' }, 503);
    expect(mocks.extractApiErrorMessage).toHaveBeenCalledWith({ error: 'x' }, 'HTTP error 503');
    expect(mapped).toBe('mapped:HTTP error 503');
  });
});
