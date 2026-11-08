import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getUserAttemptsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserAttemptsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/user-factory', () => ({
  getUserService: () => ({
    getUserAttempts: getUserAttemptsMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET, dynamic } from '@/app/api/user/attempts/route';

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function request(url = 'http://localhost/api/user/attempts'): NextRequest {
  return new NextRequest(url);
}

const routeContext = { params: Promise.resolve({}) };

const attemptsPayload = {
  attempts: [
    {
      id: '507f191e810c19729de860ea',
      score: 80,
      takenAt: '2026-01-01T00:00:00.000Z',
      totalQuestions: 10,
      quiz: { title: 'Algebra', slug: 'algebra' },
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  summary: { totalAttempts: 25, averageScore: 71.4, needsWorkCount: 6 },
};

describe('GET /api/user/attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getUserAttemptsMock.mockResolvedValue(attemptsPayload);
  });

  it('requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(getUserAttemptsMock).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination query params', async () => {
    const response = await GET(request('http://localhost/api/user/attempts?page=0&limit=999'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'validation_error' },
    });
    // pins fields meta object (kills ObjectLiteral -> {} on validation branch)
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        page: expect.any(String),
      }),
    );
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(getUserAttemptsMock).not.toHaveBeenCalled();
  });

  it('returns the authenticated user attempt list DTO with validated pagination', async () => {
    const response = await GET(request('http://localhost/api/user/attempts?page=2&limit=5'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(getUserAttemptsMock).toHaveBeenCalledWith('user-1', { page: 2, limit: 5 });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        attempts: attemptsPayload.attempts,
        pagination: attemptsPayload.pagination,
      },
    });
  });

  it('rejects an unknown result filter with validation_error (RIN-1197)', async () => {
    const response = await GET(
      request('http://localhost/api/user/attempts?result=failed'),
      routeContext,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({ result: expect.any(String) }),
    );
    expect(getUserAttemptsMock).not.toHaveBeenCalled();
  });

  it.each(['needs_work', 'passed'] as const)(
    'forwards result=%s and returns the all-attempts summary',
    async (result) => {
      const response = await GET(
        request(`http://localhost/api/user/attempts?result=${result}&page=3&limit=10`),
        routeContext,
      );

      expect(response.status).toBe(200);
      expect(getUserAttemptsMock).toHaveBeenCalledWith('user-1', { page: 3, limit: 10, result });
      await expect(response.json()).resolves.toMatchObject({
        data: { summary: attemptsPayload.summary },
      });
    },
  );

  it('maps missing users to 404 and other failures to 500', async () => {
    getUserAttemptsMock.mockRejectedValueOnce(new Error('User not found'));
    const missing = await GET(request(), routeContext);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'User not found' },
    });

    getUserAttemptsMock.mockRejectedValueOnce(new Error('db unavailable'));
    const failed = await GET(request(), routeContext);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal server error' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Get user attempts error',
    );
  });

  it('maps non-Error throws to 500 without treating empty messages as User not found', async () => {
    getUserAttemptsMock.mockRejectedValueOnce('unexpected');

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal server error' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'unexpected' }),
      'Get user attempts error',
    );
  });
});
