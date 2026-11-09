import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, reportQuizMock, reportQuizPageMock, consumeRateLimitMock, loggerErrorMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    reportQuizMock: vi.fn(),
    reportQuizPageMock: vi.fn(),
    consumeRateLimitMock: vi.fn(),
    loggerErrorMock: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    reportQuiz: reportQuizMock,
  }),
  getQuizPageReportService: () => ({
    report: reportQuizPageMock,
  }),
}));
vi.mock('@/lib/quiz-report-rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/quiz-report-rate-limit')>()),
  consumeQuizReportRateLimit: consumeRateLimitMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

function request(body: unknown, address = '203.0.113.7'): NextRequest {
  return new NextRequest(`http://localhost/api/quiz/${slug}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
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
      error: 'Personal quiz sources are only available to their owner or an admin',
      statusCode: 403,
    });

    const response = await POST(
      request({ questionId, content: 'personal source issue' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'premium_required',
        detail: 'Personal quiz sources are only available to their owner or an admin',
      },
    });
  });
});

describe('POST /api/quiz/[slug]/report, quiz-page report (RIN-1343)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_SECRET', 'test-secret-for-report-hash-0123456789');
    authMock.mockResolvedValue(null);
    consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetSeconds: 3600,
      limit: 5,
    });
    reportQuizPageMock.mockResolvedValue({ success: true, data: { reportId: 'report-2' } });
  });

  it('accepts an anonymous report and hashes the address instead of passing it on', async () => {
    const response = await POST(
      request({ reason: 'copyright', details: '  my textbook  ', email: 'owner@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ data: { reportId: 'report-2' } });
    const [calledSlug, input] = reportQuizPageMock.mock.calls[0] ?? [];
    expect(calledSlug).toBe(slug);
    expect(input).toEqual({
      reason: 'copyright',
      details: 'my textbook',
      reporterEmail: 'owner@example.com',
      ipHash: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(JSON.stringify(input)).not.toContain('203.0.113.7');
    expect(consumeRateLimitMock).toHaveBeenCalledWith(input.ipHash, slug);
  });

  it('uses the session email and name when signed in', async () => {
    authMock.mockResolvedValue(session());

    await POST(request({ reason: 'offensive', email: 'typed@example.com' }), routeContext);

    expect(reportQuizPageMock).toHaveBeenCalledWith(
      slug,
      expect.objectContaining({ reporterEmail: 'reporter@example.com', reporterName: 'Reporter' }),
    );
  });

  it('gives different addresses different hashes and the same address the same one', async () => {
    await POST(request({ reason: 'offensive' }, '198.51.100.1'), routeContext);
    await POST(request({ reason: 'offensive' }, '198.51.100.1'), routeContext);
    await POST(request({ reason: 'offensive' }, '198.51.100.2'), routeContext);

    const hashes = reportQuizPageMock.mock.calls.map(([, input]) => input.ipHash);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[0]).not.toBe(hashes[2]);
  });

  it('answers 200 to a filled honeypot and stores nothing', async () => {
    const response = await POST(
      request({ reason: 'copyright', website: 'http://spam.example' }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(reportQuizPageMock).not.toHaveBeenCalled();
  });

  it('returns 429 when a rate limit is exhausted', async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 86_000,
      limit: 1,
    });

    const response = await POST(request({ reason: 'wrong_content' }), routeContext);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'rate_limit_exceeded' },
    });
    expect(reportQuizPageMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown reason', { reason: 'spam' }],
    ['no reason', { details: 'x' }],
    ['an invalid email', { reason: 'copyright', email: 'not-an-email' }],
    ['an unknown field', { reason: 'copyright', ip: '1.2.3.4' }],
  ])('rejects %s with 400', async (_label, body) => {
    const response = await POST(request(body), routeContext);

    expect(response.status).toBe(400);
    expect(reportQuizPageMock).not.toHaveBeenCalled();
  });

  it('passes the service 404 for a quiz that is not public', async () => {
    reportQuizPageMock.mockResolvedValueOnce({
      success: false,
      error: 'Quiz not found',
      statusCode: 404,
    });

    const response = await POST(request({ reason: 'copyright' }), routeContext);

    expect(response.status).toBe(404);
  });

  it('keeps the per-question flow behind sign-in', async () => {
    const response = await POST(request({ questionId, content: 'broken' }), routeContext);

    expect(response.status).toBe(401);
    expect(reportQuizMock).not.toHaveBeenCalled();
    expect(reportQuizPageMock).not.toHaveBeenCalled();
  });

  it('logs no address, email or details when the flow fails', async () => {
    reportQuizPageMock.mockRejectedValueOnce(new Error('boom'));

    const response = await POST(
      request({ reason: 'personal_data', details: 'my phone number', email: 'me@example.com' }),
      routeContext,
    );

    expect(response.status).toBe(500);
    const logged = JSON.stringify(loggerErrorMock.mock.calls);
    expect(logged).not.toContain('203.0.113.7');
    expect(logged).not.toContain('me@example.com');
    expect(logged).not.toContain('my phone number');
  });
});
