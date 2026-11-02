import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import {
  createAdminQuizIdRoute,
  createAdminQuizVisibilityRoute,
} from '@/app/api/admin/quizzes/[id]/quiz-id-route';

const request = new NextRequest('http://localhost/api/admin/quizzes/507f1f77bcf86cd799439011');
const routeContext = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) };

describe('createAdminQuizIdRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('validates the quiz id before invoking the service', async () => {
    const execute = vi.fn();
    const route = createAdminQuizIdRoute({ execute });

    const response = await route(request, { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes the validated id and preserves success metadata', async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: { deleted: true } });
    const route = createAdminQuizIdRoute({
      execute,
      successMeta: { message: 'Quiz deleted successfully' },
    });

    const response = await route(request, routeContext);

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      meta: { message: 'Quiz deleted successfully' },
    });
  });

  it('maps service failures without invoking a second auth or validation path', async () => {
    const execute = vi.fn().mockResolvedValue({
      success: false,
      code: 'not_found',
      error: 'Quiz not found',
      statusCode: 404,
    });
    const route = createAdminQuizIdRoute({ execute });

    const response = await route(request, routeContext);

    expect(response.status).toBe(404);
    expect(authMock).toHaveBeenCalledTimes(1);
  });
});

function patchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/quizzes/507f1f77bcf86cd799439011', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('createAdminQuizVisibilityRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('rejects anonymous callers with 401 before reading the body', async () => {
    authMock.mockResolvedValue(null);
    const execute = vi.fn();
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest({ visibility: 'personal' }), routeContext);

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects non-admin users with 403', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    const execute = vi.fn();
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest({ visibility: 'personal' }), routeContext);

    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown visibility', { visibility: 'unlisted' }],
    ['a missing visibility', {}],
    ['extra fields', { visibility: 'personal', title: 'x' }],
    ['malformed JSON', '{not json'],
  ])('rejects %s with 400', async (_label, body) => {
    const execute = vi.fn();
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest(body), routeContext);

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an invalid quiz id with 400', async () => {
    const execute = vi.fn();
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest({ visibility: 'personal' }), {
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes the id, visibility and the admin as actor to the service', async () => {
    const data = {
      id: '507f1f77bcf86cd799439011',
      slug: 'fake-quiz',
      visibility: 'personal',
      changed: true,
    };
    const execute = vi.fn().mockResolvedValue({ success: true, data });
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest({ visibility: 'personal' }), routeContext);

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'personal', {
      id: 'admin-1',
      email: 'admin@example.com',
    });
    await expect(response.json()).resolves.toMatchObject({ success: true, data });
  });

  it('maps a premium refusal to 409', async () => {
    const execute = vi.fn().mockResolvedValue({
      success: false,
      code: 'conflict',
      error: 'A quiz with a premium publication cannot be made public',
      statusCode: 409,
    });
    const route = createAdminQuizVisibilityRoute({ execute });

    const response = await route(patchRequest({ visibility: 'public' }), routeContext);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'conflict' },
    });
  });
});
