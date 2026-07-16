import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import { createAdminQuizIdRoute } from '@/app/api/admin/quizzes/[id]/quiz-id-route';

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
