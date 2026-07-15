import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeOpenAISseResponse: vi.fn().mockResolvedValue('Tutor answer'),
}));

vi.mock('@/lib/ai/stream', () => ({
  consumeOpenAISseResponse: mocks.consumeOpenAISseResponse,
}));

import { streamAdaptiveTutorChat } from '@/lib/adaptive/chat';

describe('streamAdaptiveTutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it('omits absent optional signal and content callback', async () => {
    await expect(
      streamAdaptiveTutorChat('session-1', { userQuestion: 'Explain this' }),
    ).resolves.toBe('Tutor answer');

    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).not.toHaveProperty('signal');
    const [, consumeOptions] = mocks.consumeOpenAISseResponse.mock.calls[0] ?? [];
    expect(consumeOptions).not.toHaveProperty('onContent');
  });
});
