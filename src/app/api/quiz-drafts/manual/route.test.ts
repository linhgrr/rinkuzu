import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { POST } from '@/app/api/quiz-drafts/manual/route';

describe('manual quiz draft proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('ok'));
  });

  it('forwards to the manual endpoint without an AI quota action', async () => {
    const request = new NextRequest('http://localhost/api/quiz-drafts/manual', {
      method: 'POST',
      body: JSON.stringify({ title: 'Untitled quiz' }),
    });

    await POST(request, { params: Promise.resolve({}) });

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/drafts/manual',
      { userId: 'user-1', userRole: 'user' },
      { method: 'POST' },
    );
  });
});
