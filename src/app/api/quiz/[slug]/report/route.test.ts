import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, reportQuizMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  reportQuizMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    reportQuiz: reportQuizMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/quiz/[slug]/report/route';

const slug = 'algorithms';
const questionId = '507f1f77bcf86cd799439011';
const routeContext = { params: Promise.resolve({ slug }) };

function session(overrides?: { id?: string; email?: string; name?: string | null; role?: string }) {
  return {
    user: {
      id: overrides?.id ?? 'user-1',
      email: overrides?.email ?? 'reporter@example.com',
      name: overrides?.name === undefined ? 'Reporter' : overrides.name,
      role: overrides?.role ?? 'user',
    },
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/quiz/${slug}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/quiz/[slug]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    reportQuizMock.mockResolvedValue({
      success: true,
      data: { reportId: 'report-1' },
    });
  });

  it('requires authentication before reporting', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ questionId, content: 'broken question' }), routeContext);

    expect(response.status).toBe(401);
    expect(reportQuizMock).not.toHaveBeenCalled();
  });

  it('rejects invalid report content without calling the service', async () => {
    const response = await POST(request({ questionId, content: '   ' }), routeContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(reportQuizMock).not.toHaveBeenCalled();
  });

  it('submits a public-quiz report successfully with trimmed content and reporter identity', async () => {
    const response = await POST(
      request({ questionId, content: '  wrong answer key  ' }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(reportQuizMock).toHaveBeenCalledWith(
      slug,
      questionId,
      'wrong answer key',
      'reporter@example.com',
      'Reporter',
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1', email: 'reporter@example.com' }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { reportId: 'report-1' },
      meta: { message: 'Report submitted successfully' },
    });
  });

  it('falls back to the session email when the display name is missing', async () => {
    authMock.mockResolvedValue(session({ name: null }));

    await POST(request({ questionId, content: 'typo in option B' }), routeContext);

    expect(reportQuizMock).toHaveBeenCalledWith(
      slug,
      questionId,
      'typo in option B',
      'reporter@example.com',
      'reporter@example.com',
      expect.any(Object),
    );
  });

  it('maps private non-owner 403 from the service without fabricating success', async () => {
    reportQuizMock.mockResolvedValueOnce({
      success: false,
      code: 'premium_required',
      error: 'Premium subscription required to access private quizzes',
      statusCode: 403,
    });

    const response = await POST(
      request({ questionId, content: 'private quiz issue' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'premium_required',
        detail: 'Premium subscription required to access private quizzes',
      },
    });
  });
});
