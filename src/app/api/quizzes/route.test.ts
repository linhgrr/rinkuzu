import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizCreationError } from '@/lib/quiz/errors';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

const {
  assertCanContributeMock,
  authMock,
  submitSavedQuizMock,
  createQuizMock,
  getQuizzesMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  assertCanContributeMock: vi.fn(),
  authMock: vi.fn(),
  submitSavedQuizMock: vi.fn(),
  createQuizMock: vi.fn(),
  getQuizzesMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    createQuiz: createQuizMock,
    getQuizzes: getQuizzesMock,
  }),
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({
    assertCanContribute: assertCanContributeMock,
    submitSavedQuiz: submitSavedQuizMock,
  }),
}));

import { GET, POST } from '@/app/api/quizzes/route';

function session(role: 'user' | 'admin' = 'user') {
  return {
    user: {
      id: '507f191e810c19729de860eb',
      email: 'author@example.com',
      role,
    },
  };
}

function listRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/quizzes${query}`);
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/quizzes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validCreateBody = {
  title: 'Algebra',
  folderId: null,
  questions: [
    {
      question: '1+1?',
      options: ['1', '2'],
      type: 'single',
      correctIndex: 1,
    },
  ],
  submitToPremium: false,
};

describe('GET /api/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQuizzesMock.mockResolvedValue({
      quizzes: [{ id: 'quiz-1', title: 'Algebra' }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
  });

  it('lists public quizzes for anonymous callers without mine/folder filters', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(listRequest('?page=1&limit=10'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(getQuizzesMock).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      onlyMine: false,
    });
  });

  it('ignores visibility attempts on the public community catalog', async () => {
    authMock.mockResolvedValue(null);

    await GET(listRequest('?page=1&limit=12&visibility=personal'), {
      params: Promise.resolve({}),
    });
    await GET(listRequest('?page=1&limit=12&visibility=public'), {
      params: Promise.resolve({}),
    });

    const first = getQuizzesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const second = getQuizzesMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(first).toMatchObject({ onlyMine: false });
    expect(second).toMatchObject({ onlyMine: false });
    expect(first).not.toHaveProperty('visibility');
    expect(second).not.toHaveProperty('visibility');
  });

  it('applies mine, unfiled folder, and personal visibility for authenticated users', async () => {
    authMock.mockResolvedValue(session());
    assertCanContributeMock.mockResolvedValue(undefined);
    submitSavedQuizMock.mockResolvedValue({ id: 'premium-submission-1' });

    const response = await GET(
      listRequest(
        `?mine=true&folder=${encodeURIComponent(UNFILED_FOLDER_TARGET)}&visibility=personal&search=alg`,
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(getQuizzesMock).toHaveBeenCalledWith({
      search: 'alg',
      folder: null,
      page: 1,
      limit: 10,
      visibility: 'personal',
      userId: '507f191e810c19729de860eb',
      onlyMine: true,
    });
  });

  it('maps public visibility and concrete folders only when listing own quizzes', async () => {
    authMock.mockResolvedValue(session());
    const folderId = '507f1f77bcf86cd799439011';

    await GET(listRequest(`?mine=true&folder=${folderId}&visibility=public`), {
      params: Promise.resolve({}),
    });
    await GET(listRequest(`?folder=${folderId}&visibility=public`), {
      params: Promise.resolve({}),
    });

    expect(getQuizzesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        onlyMine: true,
        folder: folderId,
        visibility: 'public',
      }),
    );
    expect(getQuizzesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        onlyMine: false,
      }),
    );
    const guestishCall = getQuizzesMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(guestishCall).not.toHaveProperty('folder');
    expect(guestishCall).not.toHaveProperty('visibility');
  });

  it('rejects invalid query params and maps unexpected list failures', async () => {
    authMock.mockResolvedValue(null);
    const invalid = await GET(listRequest('?page=0'), { params: Promise.resolve({}) });
    expect(invalid.status).toBe(400);

    getQuizzesMock.mockRejectedValue(new Error('list failed'));
    const failed = await GET(listRequest(), { params: Promise.resolve({}) });
    expect(failed.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});

describe('POST /api/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    createQuizMock.mockResolvedValue({ id: 'quiz-1', title: 'Algebra' });
  });

  it('requires authentication before creating a quiz', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(createRequest(validCreateBody), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
    expect(createQuizMock).not.toHaveBeenCalled();
  });

  it('creates a quiz for authenticated users', async () => {
    const response = await POST(createRequest(validCreateBody), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(createQuizMock).toHaveBeenCalledWith(
      '507f191e810c19729de860eb',
      expect.objectContaining({ title: 'Algebra', submitToPremium: false }),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      meta: { message: 'Quiz created successfully' },
    });
  });

  it('rejects invalid create payloads', async () => {
    const response = await POST(createRequest({ title: '' }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    expect(createQuizMock).not.toHaveBeenCalled();
  });

  it('checks Premium contribution eligibility before creating the source quiz', async () => {
    const { PremiumQuizError } = await import('@/entities/PremiumQuizError');
    assertCanContributeMock.mockRejectedValueOnce(
      new PremiumQuizError('email_verification_required', 'Verify your email'),
    );

    const response = await POST(
      createRequest({ ...validCreateBody, submitToPremium: true, rightsAttested: true }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    expect(createQuizMock).not.toHaveBeenCalled();
    expect(submitSavedQuizMock).not.toHaveBeenCalled();
  });

  it('submits the saved quiz to Premium through the compensating helper (RIN-1347)', async () => {
    createQuizMock.mockResolvedValueOnce({ id: 'quiz-1', slug: 'algebra' });
    submitSavedQuizMock.mockResolvedValueOnce({ id: 'premium-submission-1' });

    const response = await POST(
      createRequest({ ...validCreateBody, submitToPremium: true, rightsAttested: true }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(submitSavedQuizMock).toHaveBeenCalledWith('507f191e810c19729de860eb', {
      quizId: 'quiz-1',
      rightsAttested: true,
    });
  });

  it('says the quiz was saved as public when the Premium submission fails (RIN-1347)', async () => {
    const { PremiumQuizError, PremiumSubmissionFailedError } =
      await import('@/entities/PremiumQuizError');
    createQuizMock.mockResolvedValue({ id: 'quiz-1', slug: 'algebra' });
    submitSavedQuizMock
      .mockRejectedValueOnce(new PremiumSubmissionFailedError('quiz-1', new Error('db down')))
      .mockRejectedValueOnce(
        new PremiumSubmissionFailedError(
          'quiz-1',
          new PremiumQuizError('invalid_state', 'Premium quiz assets could not be secured'),
        ),
      );
    const body = { ...validCreateBody, submitToPremium: true, rightsAttested: true };

    const infrastructure = await POST(createRequest(body), { params: Promise.resolve({}) });
    const refusal = await POST(createRequest(body), { params: Promise.resolve({}) });

    expect(infrastructure.status).toBe(502);
    await expect(infrastructure.json()).resolves.toMatchObject({
      error: {
        code: 'premium_submission_failed',
        meta: { reason: 'internal_error', visibility: 'public', quizId: 'quiz-1' },
      },
    });
    expect(refusal.status).toBe(409);
    await expect(refusal.json()).resolves.toMatchObject({
      error: { code: 'premium_submission_failed', meta: { reason: 'invalid_state' } },
    });
  });

  it('maps premium and validation creation errors, then unexpected failures', async () => {
    createQuizMock
      .mockRejectedValueOnce(
        new QuizCreationError('premium_required', 'Premium subscription required'),
      )
      .mockRejectedValueOnce(new QuizCreationError('invalid_folder', 'Invalid folder selected'))
      .mockRejectedValueOnce(new Error('unexpected'));

    const premium = await POST(
      createRequest({ ...validCreateBody, submitToPremium: true, rightsAttested: true }),
      {
        params: Promise.resolve({}),
      },
    );
    const validation = await POST(createRequest(validCreateBody), {
      params: Promise.resolve({}),
    });
    const unexpected = await POST(createRequest(validCreateBody), {
      params: Promise.resolve({}),
    });

    expect(premium.status).toBe(403);
    await expect(premium.json()).resolves.toMatchObject({
      error: { code: 'premium_required' },
    });
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(unexpected.status).toBe(500);
  });
});
