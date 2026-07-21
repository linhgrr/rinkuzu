import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));
import { POST, dynamic } from '@/app/api/quiz/ask-ai/route';

const request = new NextRequest('http://localhost/api/quiz/ask-ai', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ question: 'Explain this' }),
});
const routeContext = { params: Promise.resolve({}) };

describe('POST /api/quiz/ask-ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('stream'));
  });

  it('exports force-dynamic and declares the metered action at the proxy boundary', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await POST(request, routeContext);

    expect(response).toBeInstanceOf(Response);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {},
      {
        method: 'POST',
        llmAction: 'quiz_ask_ai',
        timeoutMs: 180_000,
      },
    );
  });

  it('passes authenticated identity and the metered action to the shared proxy', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    await POST(request, routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {
        userId: 'user-1',
        userRole: 'user',
      },
      {
        method: 'POST',
        llmAction: 'quiz_ask_ai',
        timeoutMs: 180_000,
      },
    );
  });

  it('keeps the same shared proxy contract for admins', async () => {
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    await POST(request, routeContext);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {
        userId: 'admin-1',
        userRole: 'admin',
      },
      { method: 'POST', llmAction: 'quiz_ask_ai', timeoutMs: 180_000 },
    );
  });
});
