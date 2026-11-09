import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, submitQuizAttemptMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  submitQuizAttemptMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    submitQuizAttempt: submitQuizAttemptMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/quiz/[slug]/attempt/route';

const slug = 'algebra';
const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';
const routeContext = { params: Promise.resolve({ slug }) };
const TOKEN = 'abcDEF012-_'.repeat(4).slice(0, 43);

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
      request({ answers: [0], idempotencyKey, guestClaimToken: TOKEN }, 'bad slug'),
      { params: Promise.resolve({ slug: 'bad slug' }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'validation_error' },
    });
    // pins non-empty fields meta (kills ObjectLiteral -> {} on param validation)
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
      }),
    );
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects invalid attempt bodies', async () => {
    const response = await POST(request({ answers: [0], guestClaimToken: TOKEN }), routeContext);

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
      error: { code: 'validation_error', detail: 'User identification required' },
    });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects a signed-out submit that sends only an email (legacy path removed, RIN-921)', async () => {
    const response = await POST(
      request({ answers: [0], idempotencyKey, userEmail: 'guest@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'User identification required' },
    });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('ignores the email an older signed-in bundle still sends', async () => {
    const session = { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };
    authMock.mockResolvedValue(session);

    const response = await POST(
      request({ answers: [0], idempotencyKey, userEmail: 'user@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      [0],
      idempotencyKey,
      session,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('accepts session email identity when user id is absent and body omits userEmail', async () => {
    // Pins optional-chaining on session.user and the AND identity gate.
    authMock.mockResolvedValue({ user: { email: 'session-only@example.com', role: 'user' } });

    const response = await POST(request({ answers: [1], idempotencyKey }), routeContext);

    expect(response.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      [1],
      idempotencyKey,
      { user: { email: 'session-only@example.com', role: 'user' } },
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('accepts guest attempts with a claim token and maps the DTO payload', async () => {
    const response = await POST(
      request({ answers: [0, [1, 2]], idempotencyKey, guestClaimToken: TOKEN }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      [0, [1, 2]],
      idempotencyKey,
      null,
      undefined,
      TOKEN,
      undefined,
      undefined,
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { attemptId: 'attempt-1', score: 100 },
    });
  });

  describe('entry attribution (RIN-1256)', () => {
    const guest = { answers: [0], idempotencyKey, guestClaimToken: TOKEN };
    const attributionOf = async (body: Record<string, unknown>) => {
      submitQuizAttemptMock.mockClear();
      const response = await POST(request({ ...guest, ...body }), routeContext);
      expect(response.status).toBe(200);
      return submitQuizAttemptMock.mock.calls[0]?.[7];
    };

    it('passes a tracked entry and a blog post to the service, guest attempts included', async () => {
      await expect(attributionOf({ entry: 'blog', post: 'on-thi-toeic' })).resolves.toEqual({
        entry: 'blog',
        post: 'on-thi-toeic',
      });
      await expect(attributionOf({ entry: 'landing' })).resolves.toEqual({ entry: 'landing' });
    });

    it('drops an unknown entry without failing the submit', async () => {
      await expect(attributionOf({ entry: 'newsletter', post: 'x' })).resolves.toBeUndefined();
    });

    it('drops a malformed post, or a post without entry=blog', async () => {
      for (const post of ['Uppercase', '../x', 'a'.repeat(81)]) {
        await expect(attributionOf({ entry: 'blog', post })).resolves.toEqual({ entry: 'blog' });
      }
      await expect(attributionOf({ entry: 'landing', post: 'ok-post' })).resolves.toEqual({
        entry: 'landing',
      });
      await expect(attributionOf({ post: 'ok-post' })).resolves.toBeUndefined();
    });

    it('passes a hub topic slug next to entry=hub only, dropping a malformed one (RIN-1417)', async () => {
      await expect(attributionOf({ entry: 'hub', topic: 'tieng-anh-lop-10' })).resolves.toEqual({
        entry: 'hub',
        topic: 'tieng-anh-lop-10',
      });
      for (const topic of ['Upper', 'a b', 'a'.repeat(81)]) {
        await expect(attributionOf({ entry: 'hub', topic })).resolves.toEqual({ entry: 'hub' });
      }
      await expect(attributionOf({ entry: 'landing', topic: 'toan' })).resolves.toEqual({
        entry: 'landing',
      });
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
      undefined,
      undefined,
      undefined,
    );
  });

  it('passes quick-round indices to the service and rejects them without quick mode (RIN-936)', async () => {
    const session = { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };
    authMock.mockResolvedValue(session);
    const answers = Array.from({ length: 10 }, () => 0);
    const questionIndices = [16, 2, 9, 0, 11, 5, 14, 7, 3, 12];

    const quick = await POST(
      request({ answers, idempotencyKey, mode: 'quick', questionIndices }),
      routeContext,
    );
    const unpaired = await POST(
      request({ answers, idempotencyKey, questionIndices }),
      routeContext,
    );

    expect(quick.status).toBe(200);
    expect(submitQuizAttemptMock).toHaveBeenCalledTimes(1);
    expect(submitQuizAttemptMock).toHaveBeenCalledWith(
      slug,
      answers,
      idempotencyKey,
      session,
      undefined,
      undefined,
      questionIndices,
      undefined,
    );
    expect(unpaired.status).toBe(400);
    await expect(unpaired.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'validation_error' },
    });
  });

  it('maps service failures through the shared API error envelope', async () => {
    submitQuizAttemptMock.mockResolvedValueOnce({
      success: false,
      code: 'premium_required',
      error: 'Personal quiz sources are only available to their owner or an admin',
      statusCode: 403,
    });

    const response = await POST(
      request({ answers: [0], idempotencyKey, guestClaimToken: TOKEN }),
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
      request({ answers: [0], idempotencyKey, guestClaimToken: TOKEN }),
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

  describe('guest claim token (RIN-912)', () => {
    const guestClaimToken = 'abcDEF012-_'.repeat(4).slice(0, 43);

    it('accepts a signed-out submit with only a claim token', async () => {
      const response = await POST(
        request({ answers: [0], idempotencyKey, guestClaimToken }),
        routeContext,
      );

      expect(response.status).toBe(200);
      expect(submitQuizAttemptMock).toHaveBeenCalledWith(
        slug,
        [0],
        idempotencyKey,
        null,
        undefined,
        guestClaimToken,
        undefined,
        undefined,
      );
    });

    it('rejects a malformed claim token', async () => {
      const response = await POST(
        request({ answers: [0], idempotencyKey, guestClaimToken: 'not-a-token' }),
        routeContext,
      );

      expect(response.status).toBe(400);
      expect(submitQuizAttemptMock).not.toHaveBeenCalled();
    });

    it('never echoes the token or its hash in the response', async () => {
      const response = await POST(
        request({ answers: [0], idempotencyKey, guestClaimToken }),
        routeContext,
      );

      const text = await response.text();
      expect(text).not.toContain(guestClaimToken);
      expect(text).not.toContain('guestClaimTokenHash');
    });
  });
});
