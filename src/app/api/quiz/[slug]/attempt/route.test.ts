import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, submitQuizAttemptMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  submitQuizAttemptMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getQuizService: () => ({
      submitQuizAttempt: submitQuizAttemptMock,
    }),
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/quiz/[slug]/attempt/route';

const slug = 'algebra';
const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';
const routeContext = { params: Promise.resolve({ slug }) };

function request(body: unknown, pathSlug = slug): NextRequest {
  return new NextRequest(`http://localhost/api/quiz/${pathSlug}/attempt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/quiz/[slug]/attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    submitQuizAttemptMock.mockResolvedValue({
      success: true,
      data: { attemptId: 'attempt-1', score: 100 },
    });
  });

  it('rejects invalid route params before reading the body contract', async () => {
    const response = await POST(
      request({ answers: [0], idempotencyKey, userEmail: 'guest@example.com' }, 'bad slug'),
      { params: Promise.resolve({ slug: 'bad slug' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects invalid attempt bodies', async () => {
    const response = await POST(
      request({ answers: [0], userEmail: 'guest@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('requires a user identity for anonymous submissions', async () => {
    const response = await POST(request({ answers: [0, 1], idempotencyKey }), routeContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'User email is required' },
    });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('accepts guest attempts with body userEmail and maps the DTO payload', async () => {
    const response = await POST(
      request({
        answers: [0, [1, 2]],
        idempotencyKey,
        userEmail: '  Guest@Example.com ',
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      [0, [1, 2]],
      idempotencyKey,
      null,
      'guest@example.com',
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { attemptId: 'attempt-1', score: 100 },
    });
  });

  it('uses the authenticated session without requiring body userEmail', async () => {
    const session = {
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    };
    authMock.mockResolvedValue(session);

    const response = await POST(request({ answers: [1], idempotencyKey }), routeContext);

    expect(response.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      [1],
      idempotencyKey,
      session,
      undefined,
    );
  });

  it('maps service failures through the shared API error envelope', async () => {
    submitQuizAttemptMock.mockResolvedValueOnce({
      success: false,
      code: 'premium_required',
      error: 'Premium subscription required to access private quizzes',
      statusCode: 403,
    });

    const response = await POST(
      request({ answers: [0], idempotencyKey, userEmail: 'guest@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'premium_required' },
    });
  });

  it('maps unexpected exceptions to a safe 500', async () => {
    submitQuizAttemptMock.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(
      request({ answers: [0], idempotencyKey, userEmail: 'guest@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal server error' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Submit attempt error',
    );
  });
});
