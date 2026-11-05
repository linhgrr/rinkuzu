import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

const request = new NextRequest('http://localhost/api/quiz/algebra/play');

async function callRoute(
  handler: ReturnType<typeof createOptionalQuizSlugReadRoute>,
  slug = 'algebra',
) {
  return handler(request, { params: Promise.resolve({ slug }) });
}

describe('createOptionalQuizSlugReadRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
  });

  it('passes validated slug and optional auth context to the loader', async () => {
    const load = vi.fn().mockResolvedValue({ success: true, data: { id: 'quiz-1' } });
    const handler = createOptionalQuizSlugReadRoute({
      load,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load quiz',
    });

    const response = await callRoute(handler);

    expect(load).toHaveBeenCalledWith({
      slug: 'algebra',
      userId: 'user-1',
      session: expect.objectContaining({ user: expect.objectContaining({ role: 'user' }) }),
      request: expect.any(Request),
    });
    expect(response.status).toBe(200);
  });

  it('supports anonymous reads without manufacturing an identity', async () => {
    authMock.mockResolvedValue(null);
    const load = vi.fn().mockResolvedValue({ success: true, data: { id: 'quiz-1' } });
    const handler = createOptionalQuizSlugReadRoute({
      load,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load quiz',
    });

    await callRoute(handler);

    expect(load).toHaveBeenCalledWith({
      slug: 'algebra',
      userId: null,
      session: null,
      request: expect.any(Request),
    });
  });

  it('rejects invalid slugs before calling the loader', async () => {
    const load = vi.fn();
    const handler = createOptionalQuizSlugReadRoute({
      load,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load quiz',
    });

    const response = await callRoute(handler, 'invalid slug');

    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it('preserves service failures and hides unexpected errors', async () => {
    const failureHandler = createOptionalQuizSlugReadRoute({
      load: vi.fn().mockResolvedValue({
        success: false,
        code: 'subscription_required',
        error: 'Premium subscription required',
        statusCode: 403,
      }),
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load quiz',
    });
    const failureResponse = await callRoute(failureHandler);

    expect(failureResponse.status).toBe(403);

    const error = new Error('database unavailable');
    const errorHandler = createOptionalQuizSlugReadRoute({
      load: vi.fn().mockRejectedValue(error),
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load quiz',
    });
    const errorResponse = await callRoute(errorHandler);

    expect(errorResponse.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error }, 'load failed');
  });
});
