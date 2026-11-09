import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizCreationError, QuizDraftSynchronizationError } from '@/lib/quiz/errors';
import { PremiumSubmissionFailedError } from '@/entities/PremiumQuizError';

const {
  authMock,
  createQuizFromDraftMock,
  getQuizByIdMock,
  fetchQuizDraftServerMock,
  loggerErrorMock,
  buildAdaptiveUrlMock,
  buildAdaptiveServiceHeadersMock,
  resolveAdaptiveProxyTimeoutMsMock,
  assertCanContributeMock,
  submitSavedQuizMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  createQuizFromDraftMock: vi.fn(),
  getQuizByIdMock: vi.fn(),
  fetchQuizDraftServerMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  buildAdaptiveUrlMock: vi.fn((path: string) => `https://adaptive.test/api${path}`),
  buildAdaptiveServiceHeadersMock: vi.fn((userId: string, userRole?: string | null) => ({
    'X-User-Id': userId,
    ...(userRole ? { 'X-User-Role': userRole } : {}),
  })),
  resolveAdaptiveProxyTimeoutMsMock: vi.fn(() => 5_000),
  assertCanContributeMock: vi.fn(),
  submitSavedQuizMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/quiz/draftServer', () => ({
  fetchQuizDraftServer: fetchQuizDraftServerMock,
}));
vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveUrl: buildAdaptiveUrlMock,
  buildAdaptiveServiceHeaders: buildAdaptiveServiceHeadersMock,
  resolveAdaptiveProxyTimeoutMs: resolveAdaptiveProxyTimeoutMsMock,
}));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    createQuizFromDraft: createQuizFromDraftMock,
    getQuizById: getQuizByIdMock,
  }),
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({
    assertCanContribute: assertCanContributeMock,
    submitSavedQuiz: submitSavedQuizMock,
  }),
}));

import { POST } from '@/app/api/quiz-drafts/[id]/submit/route';

const DRAFT_ID = '507f1f77bcf86cd799439011';
const QUIZ_ID = '507f191e810c19729de860ea';
const USER_ID = '507f191e810c19729de860eb';

const validBody = {
  title: 'Arithmetic',
  description: 'Basic addition',
  folderId: null as string | null,
  questions: [
    {
      question: 'What is 2 + 2?',
      options: ['3', '4'],
      type: 'single' as const,
      correctIndex: 1,
    },
  ],
  submitToPremium: false,
};

function authSession(role: 'user' | 'admin' = 'user') {
  return {
    user: {
      id: USER_ID,
      email: 'author@example.com',
      role,
    },
  };
}

function routeContext(id = DRAFT_ID) {
  return { params: Promise.resolve({ id }) };
}

function submitRequest(body: unknown = validBody, id = DRAFT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/quiz-drafts/${id}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/quiz-drafts/[id]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(authSession());
    fetchQuizDraftServerMock.mockResolvedValue({
      id: DRAFT_ID,
      status: 'ready',
      submittedQuizId: null,
    });
    createQuizFromDraftMock.mockResolvedValue({
      id: QUIZ_ID,
      slug: 'arithmetic',
    });
    submitSavedQuizMock.mockResolvedValue({ id: 'premium-submission-1' });
    assertCanContributeMock.mockResolvedValue(undefined);
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, slug: 'arithmetic' },
    });
    buildAdaptiveUrlMock.mockImplementation((path: string) => `https://adaptive.test/api${path}`);
    buildAdaptiveServiceHeadersMock.mockImplementation(
      (userId: string, userRole?: string | null) => ({
        'X-User-Id': userId,
        ...(userRole ? { 'X-User-Role': userRole } : {}),
      }),
    );
    resolveAdaptiveProxyTimeoutMsMock.mockReturnValue(5_000);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('authentication', () => {
    it('rejects unauthenticated callers', async () => {
      authMock.mockResolvedValue(null);

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: { code: 'unauthorized' },
      });
      expect(fetchQuizDraftServerMock).not.toHaveBeenCalled();
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });

    it('rejects sessions without a user', async () => {
      authMock.mockResolvedValue({});

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(401);
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });

    it('rejects sessions missing user id or email', async () => {
      authMock.mockResolvedValue({
        user: { email: 'author@example.com', role: 'user' },
      });
      const missingId = await POST(submitRequest(), routeContext());

      authMock.mockResolvedValue({
        user: { id: USER_ID, role: 'user' },
      });
      const missingEmail = await POST(submitRequest(), routeContext());

      expect(missingId.status).toBe(401);
      expect(missingEmail.status).toBe(401);
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });
  });

  describe('input and param validation', () => {
    it('rejects invalid draft id params before loading the draft', async () => {
      const response = await POST(submitRequest(validBody, 'bad/id'), {
        params: Promise.resolve({ id: 'bad/id' }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'validation_error',
          meta: expect.objectContaining({ fields: expect.any(Object) }),
        }),
      });
      expect(fetchQuizDraftServerMock).not.toHaveBeenCalled();
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON bodies', async () => {
      const request = new NextRequest(`http://localhost/api/quiz-drafts/${DRAFT_ID}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      });

      const response = await POST(request, routeContext());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'validation_error',
          detail: 'Request body must be valid JSON',
        }),
      });
      expect(fetchQuizDraftServerMock).not.toHaveBeenCalled();
    });

    it('rejects incomplete submit payloads', async () => {
      const response = await POST(
        submitRequest({ title: '', questions: [], submitToPremium: false }),
        routeContext(),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'validation_error',
          meta: expect.objectContaining({ fields: expect.any(Object) }),
        }),
      });
      expect(fetchQuizDraftServerMock).not.toHaveBeenCalled();
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });

    it('rejects questions that fail schema validation', async () => {
      const response = await POST(
        submitRequest({
          ...validBody,
          questions: [
            {
              question: 'Select one',
              options: ['A', 'B'],
              type: 'single',
              correctIndex: 3,
            },
          ],
        }),
        routeContext(),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: { code: 'validation_error' },
      });
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });
  });

  describe('draft lookup and ownership', () => {
    it('loads the draft with the authenticated user id before mutating', async () => {
      await POST(submitRequest(), routeContext());

      expect(fetchQuizDraftServerMock).toHaveBeenCalledWith(DRAFT_ID, USER_ID);
      expect(createQuizFromDraftMock).toHaveBeenCalledWith(
        USER_ID,
        DRAFT_ID,
        expect.objectContaining({
          title: 'Arithmetic',
          description: 'Basic addition',
          folderId: null,
          submitToPremium: false,
        }),
      );
    });

    it('continues creation when the draft is missing or not submitted', async () => {
      fetchQuizDraftServerMock.mockResolvedValueOnce(null);
      const missing = await POST(submitRequest(), routeContext());

      fetchQuizDraftServerMock.mockResolvedValueOnce({
        id: DRAFT_ID,
        status: 'ready',
        submittedQuizId: null,
      });
      const ready = await POST(submitRequest(), routeContext());

      expect(missing.status).toBe(200);
      expect(ready.status).toBe(200);
      expect(createQuizFromDraftMock).toHaveBeenCalledTimes(2);
      expect(getQuizByIdMock).not.toHaveBeenCalled();
    });

    it('continues creation when submitted status lacks a quiz id', async () => {
      fetchQuizDraftServerMock.mockResolvedValue({
        id: DRAFT_ID,
        status: 'submitted',
        submittedQuizId: null,
      });

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(200);
      expect(getQuizByIdMock).not.toHaveBeenCalled();
      expect(createQuizFromDraftMock).toHaveBeenCalledOnce();
    });
  });

  describe('idempotent and conflict status paths', () => {
    it('reuses the existing quiz when the draft is already submitted', async () => {
      fetchQuizDraftServerMock.mockResolvedValue({
        id: DRAFT_ID,
        status: 'submitted',
        submittedQuizId: QUIZ_ID,
      });
      getQuizByIdMock.mockResolvedValue({
        success: true,
        data: { id: QUIZ_ID, slug: 'existing-slug' },
      });

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(200);
      expect(getQuizByIdMock).toHaveBeenCalledWith(QUIZ_ID, USER_ID, 'user');
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        data: {
          quizId: QUIZ_ID,
          slug: 'existing-slug',
          warnings: ['too_few_questions'],
        },
      });
    });

    it('forwards admin role on idempotent getQuizById reuse', async () => {
      authMock.mockResolvedValue(authSession('admin'));
      fetchQuizDraftServerMock.mockResolvedValue({
        id: DRAFT_ID,
        status: 'submitted',
        submittedQuizId: QUIZ_ID,
      });
      getQuizByIdMock.mockResolvedValue({
        success: true,
        data: { id: QUIZ_ID, slug: 'admin-existing-slug' },
      });

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(200);
      expect(getQuizByIdMock).toHaveBeenCalledWith(QUIZ_ID, USER_ID, 'admin');
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        data: {
          quizId: QUIZ_ID,
          slug: 'admin-existing-slug',
        },
      });
    });

    it('returns conflict when the submitted quiz no longer exists', async () => {
      fetchQuizDraftServerMock.mockResolvedValue({
        id: DRAFT_ID,
        status: 'submitted',
        submittedQuizId: QUIZ_ID,
      });
      getQuizByIdMock
        .mockResolvedValueOnce({
          success: false,
          code: 'not_found',
          error: 'Quiz not found',
          statusCode: 404,
        })
        .mockResolvedValueOnce({
          success: true,
          data: null,
        });

      const missing = await POST(submitRequest(), routeContext());
      const nullData = await POST(submitRequest(), routeContext());

      for (const response of [missing, nullData]) {
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
          success: false,
          error: {
            code: 'conflict',
            detail: 'Draft points to a submitted quiz that no longer exists',
          },
        });
      }
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });
  });

  describe('mutation and success response', () => {
    it('creates the quiz, marks the draft submitted, and returns warnings', async () => {
      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(200);
      expect(createQuizFromDraftMock).toHaveBeenCalledWith(USER_ID, DRAFT_ID, {
        title: 'Arithmetic',
        description: 'Basic addition',
        folderId: null,
        questions: [
          {
            question: 'What is 2 + 2?',
            options: ['3', '4'],
            type: 'single',
            correctIndex: 1,
          },
        ],
        submitToPremium: false,
      });
      expect(buildAdaptiveUrlMock).toHaveBeenCalledWith(`/quiz/drafts/${DRAFT_ID}/submit`);
      expect(buildAdaptiveServiceHeadersMock).toHaveBeenCalledWith(USER_ID, 'user');
      expect(fetch).toHaveBeenCalledWith(
        `https://adaptive.test/api/quiz/drafts/${DRAFT_ID}/submit`,
        expect.objectContaining({
          method: 'POST',
          cache: 'no-store',
          body: JSON.stringify({ quiz_id: QUIZ_ID, retain_source: false }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID,
            'X-User-Role': 'user',
          }),
        }),
      );
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          quizId: QUIZ_ID,
          slug: 'arithmetic',
          warnings: ['too_few_questions'],
        },
      });
    });

    it('passes optional folderId and admin role through create and mark paths', async () => {
      const folderId = '507f1f77bcf86cd7994390aa';
      authMock.mockResolvedValue(authSession('admin'));
      createQuizFromDraftMock.mockResolvedValue({
        id: QUIZ_ID,
        slug: 'private-quiz',
      });
      fetchQuizDraftServerMock
        .mockResolvedValueOnce({
          id: DRAFT_ID,
          status: 'ready',
          submittedQuizId: null,
        })
        .mockResolvedValueOnce({
          id: DRAFT_ID,
          status: 'submitted',
          submittedQuizId: QUIZ_ID,
          pdf: {
            s3Key: `uploads/premium_sources/${DRAFT_ID}/source.pdf`,
            fileHash: 'a'.repeat(64),
            retainedForPremium: true,
          },
        });

      const response = await POST(
        submitRequest({
          ...validBody,
          folderId,
          submitToPremium: true,
          rightsAttested: true,
          questions: Array.from({ length: 5 }, (_, index) => ({
            question: `Q${index + 1}?`,
            options: ['A', 'B'],
            type: 'single',
            correctIndex: 0,
          })),
        }),
        routeContext(),
      );

      expect(response.status).toBe(200);
      expect(createQuizFromDraftMock).toHaveBeenCalledWith(
        USER_ID,
        DRAFT_ID,
        expect.objectContaining({
          folderId,
          submitToPremium: true,
        }),
      );
      expect(buildAdaptiveServiceHeadersMock).toHaveBeenCalledWith(USER_ID, 'admin');
      expect(fetch).toHaveBeenCalledWith(
        `https://adaptive.test/api/quiz/drafts/${DRAFT_ID}/submit`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID,
            'X-User-Role': 'admin',
          }),
        }),
      );
      const fetchInit = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
      expect(JSON.parse(String(fetchInit?.body))).toEqual({
        quiz_id: QUIZ_ID,
        retain_source: true,
      });
      expect(fetchInit?.headers).toEqual(
        expect.objectContaining({
          'X-User-Id': USER_ID,
          'X-User-Role': 'admin',
          'Content-Type': 'application/json',
        }),
      );
      expect(submitSavedQuizMock).toHaveBeenCalledWith(USER_ID, {
        quizId: QUIZ_ID,
        rightsAttested: true,
        documentFingerprint: 'a'.repeat(64),
        sourceObjectKey: `uploads/premium_sources/${DRAFT_ID}/source.pdf`,
      });
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        data: {
          quizId: QUIZ_ID,
          slug: 'private-quiz',
          warnings: [],
        },
      });
    });

    it('says the quiz was saved as public when the Premium submission fails (RIN-1347)', async () => {
      fetchQuizDraftServerMock
        .mockResolvedValueOnce({ id: DRAFT_ID, status: 'ready', submittedQuizId: null })
        .mockResolvedValueOnce({
          id: DRAFT_ID,
          status: 'submitted',
          submittedQuizId: QUIZ_ID,
          pdf: {
            s3Key: `uploads/premium_sources/${DRAFT_ID}/source.pdf`,
            retainedForPremium: true,
          },
        });
      submitSavedQuizMock.mockRejectedValueOnce(
        new PremiumSubmissionFailedError(QUIZ_ID, new Error('storage copy failed')),
      );

      const response = await POST(
        submitRequest({ ...validBody, submitToPremium: true, rightsAttested: true }),
        routeContext(),
      );

      expect(response.status).toBe(502);
      expect(submitSavedQuizMock).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ quizId: QUIZ_ID }),
      );
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'premium_submission_failed',
          meta: { reason: 'internal_error', visibility: 'public', quizId: QUIZ_ID },
        },
      });
    });

    it('maps omitted folderId to null for createQuizFromDraft', async () => {
      const { folderId: _omittedFolderId, ...bodyWithoutFolderId } = validBody;

      const response = await POST(submitRequest(bodyWithoutFolderId), routeContext());

      expect(response.status).toBe(200);
      expect(createQuizFromDraftMock).toHaveBeenCalledWith(
        USER_ID,
        DRAFT_ID,
        expect.objectContaining({
          folderId: null,
        }),
      );
      expect(Object.hasOwn(bodyWithoutFolderId, 'folderId')).toBe(false);
    });

    it('wires adaptive timeout resolver into the draft-submit fetch AbortSignal', async () => {
      resolveAdaptiveProxyTimeoutMsMock.mockReturnValue(7_500);

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        `https://adaptive.test/api/quiz/drafts/${DRAFT_ID}/submit`,
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal),
        }),
      );
      const fetchInit = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
      expect(fetchInit?.signal).toBeInstanceOf(AbortSignal);
      expect(fetchInit?.signal?.aborted).toBe(false);
    });
  });

  describe('error and catch mapping', () => {
    it('maps premium QuizCreationError to 403 premium_required', async () => {
      createQuizFromDraftMock.mockRejectedValue(
        new QuizCreationError('premium_required', 'Premium subscription required'),
      );

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'premium_required',
          detail: 'Premium subscription required',
        },
      });
      expect(loggerErrorMock).toHaveBeenCalledWith(
        { error: expect.any(QuizCreationError) },
        'Submit draft error',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['invalid_draft', 'Draft is not ready'],
      ['invalid_folder', 'Invalid folder selected'],
      ['slug_conflict', 'Slug already exists'],
    ] as const)('maps QuizCreationError %s to 400 validation_error', async (code, message) => {
      createQuizFromDraftMock.mockRejectedValue(new QuizCreationError(code, message));

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'validation_error',
          detail: message,
        },
      });
      expect(loggerErrorMock).toHaveBeenCalled();
      // Validation-class create failures must not mark the draft submitted.
      expect(fetch).not.toHaveBeenCalled();
    });

    it('maps non-ok draft sync responses to 502 upstream_error with status meta', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('upstream failed', { status: 503 })),
      );

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_error',
          detail: 'Failed to synchronize the submitted quiz draft',
          meta: {
            draftId: DRAFT_ID,
            quizId: QUIZ_ID,
            upstreamStatus: 503,
          },
        },
      });
      expect(loggerErrorMock).toHaveBeenCalledWith(
        { error: expect.any(QuizDraftSynchronizationError) },
        'Submit draft error',
      );
    });

    it('maps network draft sync failures to 502 without upstreamStatus', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

      const response = await POST(submitRequest(), routeContext());
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'upstream_error',
          detail: 'Failed to synchronize the submitted quiz draft',
          meta: {
            draftId: DRAFT_ID,
            quizId: QUIZ_ID,
          },
        },
      });
      expect(body.error.meta).not.toHaveProperty('upstreamStatus');
      expect(loggerErrorMock).toHaveBeenCalled();
    });

    it('maps unexpected failures to 500 internal_error', async () => {
      fetchQuizDraftServerMock.mockRejectedValue(new Error('boom'));

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'internal_error',
          detail: 'Failed to submit draft',
        },
      });
      expect(loggerErrorMock).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Submit draft error',
      );
      expect(createQuizFromDraftMock).not.toHaveBeenCalled();
    });

    it('maps unexpected createQuizFromDraft failures to 500', async () => {
      createQuizFromDraftMock.mockRejectedValue(new Error('db unavailable'));

      const response = await POST(submitRequest(), routeContext());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: { code: 'internal_error', detail: 'Failed to submit draft' },
      });
      expect(loggerErrorMock).toHaveBeenCalled();
    });
  });
});
