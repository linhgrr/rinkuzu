import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock, checkLlmRateLimitMock, buildLlmRateLimitResponseMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    proxyAdaptiveRequestMock: vi.fn(),
    checkLlmRateLimitMock: vi.fn(),
    buildLlmRateLimitResponseMock: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));
vi.mock('@/lib/llm/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/llm/rate-limit')>();
  return {
    ...actual,
    checkLlmRateLimit: checkLlmRateLimitMock,
    buildLlmRateLimitResponse: buildLlmRateLimitResponseMock,
  };
});

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
    checkLlmRateLimitMock.mockResolvedValue({ allowed: true });
    buildLlmRateLimitResponseMock.mockReturnValue(new Response('limited', { status: 429 }));
  });

  it('exports force-dynamic and proxies guest callers without rate limiting', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await POST(request, routeContext);

    expect(response).toBeInstanceOf(Response);
    expect(checkLlmRateLimitMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {},
      {
        method: 'POST',
        timeoutMs: 180_000,
      },
    );
  });

  it('rate-limits authenticated non-admin users before proxying identity', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    await POST(request, routeContext);

    expect(checkLlmRateLimitMock).toHaveBeenCalledWith('user-1', 'quiz_ask_ai');
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {
        userId: 'user-1',
        userRole: 'user',
      },
      {
        method: 'POST',
        timeoutMs: 180_000,
      },
    );
  });

  it('skips rate limiting for admins and returns the rate-limit response when blocked', async () => {
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    await POST(request, routeContext);
    expect(checkLlmRateLimitMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/ask-ai',
      {
        userId: 'admin-1',
        userRole: 'admin',
      },
      expect.objectContaining({ method: 'POST', timeoutMs: 180_000 }),
    );

    const limited = {
      allowed: false,
      action: 'quiz_ask_ai',
      tier: 'free',
      retryAfterSeconds: 12,
      minute: { limit: 5, remaining: 0, resetAt: new Date() },
      day: { limit: 50, remaining: 10, resetAt: new Date() },
    };
    authMock.mockResolvedValue({
      user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
    });
    checkLlmRateLimitMock.mockResolvedValueOnce(limited);

    const response = await POST(request, routeContext);

    expect(buildLlmRateLimitResponseMock).toHaveBeenCalledWith(limited);
    expect(response.status).toBe(429);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledTimes(1);
  });
});
