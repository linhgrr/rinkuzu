import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { createQuizProgressRoute } from '@/app/api/quiz/[slug]/progress/progress-route';

const request = new NextRequest('http://localhost/api/quiz/algebra/progress');
const routeContext = { params: Promise.resolve({ slug: 'algebra' }) };

describe('createQuizProgressRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
  });

  it('validates the slug before invoking the route handler', async () => {
    const handle = vi.fn();
    const route = createQuizProgressRoute({ handle, logMessage: 'progress failed' });

    const response = await route(request, { params: Promise.resolve({ slug: 'invalid slug' }) });

    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it('passes the request, validated slug, and authenticated user id', async () => {
    const handle = vi.fn().mockResolvedValue(new Response('ok'));
    const route = createQuizProgressRoute({ handle, logMessage: 'progress failed' });

    await route(request, routeContext);

    expect(handle).toHaveBeenCalledWith({
      request,
      slug: 'algebra',
      userId: 'user-1',
      userRole: 'user',
    });
  });

  it('logs handler failures and returns a safe error response', async () => {
    const error = new Error('database unavailable');
    const route = createQuizProgressRoute({
      handle: vi.fn().mockRejectedValue(error),
      logMessage: 'progress failed',
    });

    const response = await route(request, routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error }, 'progress failed');
  });
});
