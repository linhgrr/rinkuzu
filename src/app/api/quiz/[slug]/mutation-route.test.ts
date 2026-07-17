import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { authMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { createQuizSlugMutationRoute } from '@/app/api/quiz/[slug]/mutation-route';

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/quiz/algebra/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const routeContext = { params: Promise.resolve({ slug: 'algebra' }) };

function createRoute(
  execute = vi.fn().mockResolvedValue({ success: true, data: { saved: true } }),
) {
  return {
    execute,
    route: createQuizSlugMutationRoute({
      schema: z.object({ content: z.string().min(1) }),
      execute,
      successMeta: { message: 'Saved' },
      logMessage: 'mutation failed',
      publicErrorMessage: 'Unable to save',
    }),
  };
}

describe('createQuizSlugMutationRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user', name: 'Learner' },
    });
  });

  it('validates route params and body before executing the service', async () => {
    const { execute, route } = createRoute();

    const invalidSlugResponse = await route(request({ content: 'hello' }), {
      params: Promise.resolve({ slug: 'invalid slug' }),
    });
    const invalidBodyResponse = await route(request({ content: '' }), routeContext);

    expect(invalidSlugResponse.status).toBe(400);
    expect(invalidBodyResponse.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes the validated mutation context and success metadata', async () => {
    const { execute, route } = createRoute();

    const response = await route(request({ content: 'hello' }), routeContext);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'algebra',
        input: { content: 'hello' },
        email: 'user@example.com',
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ meta: { message: 'Saved' } });
  });

  it('uses the shared auth boundary when the session email is missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', role: 'user' } });
    const { execute, route } = createRoute();

    const response = await route(request({ content: 'hello' }), routeContext);

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('logs rejected service calls and returns the configured safe error', async () => {
    const error = new Error('database unavailable');
    const { route } = createRoute(vi.fn().mockRejectedValue(error));

    const response = await route(request({ content: 'hello' }), routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error }, 'mutation failed');
  });
});
