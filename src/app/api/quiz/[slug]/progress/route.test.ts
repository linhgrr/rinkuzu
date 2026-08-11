import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getSavedQuizProgressMock,
  saveQuizProgressMock,
  deleteSavedQuizProgressMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSavedQuizProgressMock: vi.fn(),
  saveQuizProgressMock: vi.fn(),
  deleteSavedQuizProgressMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    getSavedQuizProgress: getSavedQuizProgressMock,
    saveQuizProgress: saveQuizProgressMock,
    deleteSavedQuizProgress: deleteSavedQuizProgressMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET, PUT, DELETE } from '@/app/api/quiz/[slug]/progress/route';

const slug = 'algebra';
const routeContext = { params: Promise.resolve({ slug }) };

const progressPayload = {
  questionOrder: [0, 1],
  optionOrders: [
    [0, 1],
    [1, 0],
  ],
  userAnswers: [0, -1],
  currentQuestionIndex: 1,
  answeredCount: 1,
  totalQuestions: 2,
};

function session(role = 'user') {
  return {
    user: { id: 'user-1', email: 'user@example.com', role },
  };
}

function putRequest(body: unknown, pathSlug = slug) {
  return new NextRequest(`http://localhost/api/quiz/${pathSlug}/progress`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/quiz/[slug]/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getSavedQuizProgressMock.mockResolvedValue({
      success: true,
      data: { progress: progressPayload },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(`http://localhost/api/quiz/${slug}/progress`),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(getSavedQuizProgressMock).not.toHaveBeenCalled();
  });

  it('loads saved progress for the authenticated user and role', async () => {
    authMock.mockResolvedValue(session('admin'));

    const response = await GET(
      new NextRequest(`http://localhost/api/quiz/${slug}/progress`),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(getSavedQuizProgressMock).toHaveBeenCalledWith(slug, 'user-1', 'admin');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { progress: progressPayload },
    });
  });

  it('maps service failures for get progress', async () => {
    getSavedQuizProgressMock.mockResolvedValueOnce({
      success: false,
      error: 'Quiz not found',
      statusCode: 404,
      code: 'not_found',
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/quiz/${slug}/progress`),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Quiz not found' },
    });
  });
});

describe('PUT /api/quiz/[slug]/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    saveQuizProgressMock.mockResolvedValue({
      success: true,
      data: { saved: true },
    });
  });

  it('rejects invalid progress bodies before persistence', async () => {
    const response = await PUT(
      putRequest({
        questionOrder: [0],
        optionOrders: [[0, 1]],
        userAnswers: [0, 1],
        currentQuestionIndex: 0,
        answeredCount: 1,
        totalQuestions: 1,
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(saveQuizProgressMock).not.toHaveBeenCalled();
  });

  it('saves validated progress for the authenticated user', async () => {
    const response = await PUT(putRequest(progressPayload), routeContext);

    expect(response.status).toBe(200);
    expect(saveQuizProgressMock).toHaveBeenCalledWith(slug, 'user-1', progressPayload, 'user');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { saved: true },
    });
  });

  it('maps save service failures through the shared error envelope', async () => {
    saveQuizProgressMock.mockResolvedValueOnce({
      success: false,
      error: 'Premium subscription required',
      statusCode: 403,
      code: 'premium_required',
    });

    const response = await PUT(putRequest(progressPayload), routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'premium_required' },
    });
  });
});

describe('DELETE /api/quiz/[slug]/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    deleteSavedQuizProgressMock.mockResolvedValue({
      success: true,
      data: { deleted: true },
    });
  });

  it('deletes saved progress for the authenticated user', async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/quiz/${slug}/progress`, { method: 'DELETE' }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(deleteSavedQuizProgressMock).toHaveBeenCalledWith(slug, 'user-1', 'user');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true },
    });
  });

  it('maps delete service failures through the shared error envelope', async () => {
    deleteSavedQuizProgressMock.mockResolvedValueOnce({
      success: false,
      error: 'Quiz not found',
      statusCode: 404,
      code: 'not_found',
    });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/quiz/${slug}/progress`, { method: 'DELETE' }),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Quiz not found' },
    });
  });
});
