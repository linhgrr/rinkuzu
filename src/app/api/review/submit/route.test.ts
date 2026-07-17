import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, submitReviewMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  submitReviewMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/learning-progress-factory', () => ({
  getLearningProgressService: () => ({
    submitReview: submitReviewMock,
  }),
}));

import { POST } from '@/app/api/review/submit/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

const validBody = {
  questionId: 'q-1',
  quizSlug: 'algebra',
  rating: 'good' as const,
};

function request(body: unknown) {
  return new NextRequest('http://localhost/api/review/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/review/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    submitReviewMock.mockResolvedValue({
      success: true,
      data: {
        questionProgress: {
          id: 'qp-1',
          questionId: 'q-1',
          quizSlug: 'algebra',
          srsLevel: 2,
        },
        userProgress: {
          xp: 120,
          streak: 4,
          xpGained: 10,
          streakFreezeUsed: false,
        },
      },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(401);
    expect(submitReviewMock).not.toHaveBeenCalled();
  });

  it('rejects invalid review payloads with field-level meta', async () => {
    const response = await POST(
      request({ questionId: '', quizSlug: '', rating: 'invalid' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toEqual(expect.any(Object));
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(submitReviewMock).not.toHaveBeenCalled();
  });

  it('submits a validated review for the authenticated user and returns progress DTOs', async () => {
    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(200);
    expect(submitReviewMock).toHaveBeenCalledWith('user-1', validBody);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        questionProgress: { questionId: 'q-1', srsLevel: 2 },
        userProgress: { xp: 120, streak: 4, xpGained: 10, streakFreezeUsed: false },
      },
      meta: { message: 'Review submitted' },
    });
  });

  it('maps service failures through the shared error envelope', async () => {
    submitReviewMock.mockResolvedValueOnce({
      success: false,
      error: 'Question progress not found',
      statusCode: 404,
      code: 'not_found',
    });

    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Question progress not found' },
    });
  });
});
