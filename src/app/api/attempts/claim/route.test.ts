import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, claimMock, loggerErrorMock, optInMock, rateMock } = vi.hoisted(() => ({
  optInMock: vi.fn(),
  authMock: vi.fn(),
  claimMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  rateMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/communication/review-reminder', () => ({ optInReviewReminder: optInMock }));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: rateMock,
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/guest-attempt-claim-factory', () => ({
  getGuestAttemptClaimService: () => ({ claimWithHashes: claimMock }),
}));

import { dynamic, POST } from '@/app/api/attempts/claim/route';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';

const routeContext = { params: Promise.resolve({}) };
const TOKEN = 'A'.repeat(43);
const OTHER = 'b'.repeat(42) + '_';
const ALLOWED = { allowed: true, remaining: 9, resetSeconds: 60, limit: 10 };
const DENIED = { allowed: false, retryAfterSeconds: 60, limit: 10 };

function request(body: unknown, ip = '203.0.113.7'): NextRequest {
  return new NextRequest('http://localhost/api/attempts/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/attempts/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1', email: 'learner@example.test' } });
    rateMock.mockResolvedValue(ALLOWED);
    claimMock.mockResolvedValue([
      { attemptId: 'attempt-1', tokenHash: hashGuestClaimToken(TOKEN) },
    ]);
    optInMock.mockResolvedValue({ optedIn: true, status: 'scheduled', scheduledFor: 'x' });
  });

  it('is force-dynamic and returns 401 when signed out', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request({ tokens: [TOKEN] }), routeContext)).status).toBe(401);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no tokens', { tokens: [] }],
    ['more than 20 tokens', { tokens: Array.from({ length: 21 }, () => TOKEN) }],
    ['a malformed token', { tokens: [TOKEN, 'short'] }],
    ['a non-string token', { tokens: [42] }],
    ['extra fields', { tokens: [TOKEN], userId: 'someone-else' }],
    ['a malformed opt-in token', { tokens: [TOKEN], reviewOptInTokens: ['short'] }],
  ])('returns 400 for %s', async (_label, body) => {
    const response = await POST(request(body), routeContext);
    expect(response.status).toBe(400);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it('claims for the session user and returns the claimed ids', async () => {
    const response = await POST(request({ tokens: [TOKEN, OTHER] }), routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { claimedAttemptIds: ['attempt-1'], reviewOptInAttemptIds: [] },
    });
    expect(claimMock).toHaveBeenCalledWith('user-1', [TOKEN, OTHER]);
    expect(rateMock).toHaveBeenCalledWith('attempt_claim_user', 'user-1');
    expect(rateMock).toHaveBeenCalledWith('attempt_claim_ip', '203.0.113.7');
  });

  it('returns the same 200 shape when nothing matched', async () => {
    claimMock.mockResolvedValueOnce([]);
    const response = await POST(request({ tokens: [TOKEN] }), routeContext);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { claimedAttemptIds: [], reviewOptInAttemptIds: [] },
    });
  });

  it('records the guest_result_review opt-in for a claimed opt-in token', async () => {
    const response = await POST(
      request({ tokens: [TOKEN, OTHER], reviewOptInTokens: [TOKEN] }),
      routeContext,
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { claimedAttemptIds: ['attempt-1'], reviewOptInAttemptIds: ['attempt-1'] },
    });
    expect(optInMock).toHaveBeenCalledOnce();
    expect(optInMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'learner@example.test',
      attemptId: 'attempt-1',
      locale: 'vi',
      ip: '203.0.113.7',
      consentSource: 'guest_result_review',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('uses the page locale from the Referer', async () => {
    const req = new NextRequest('http://localhost/api/attempts/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json', referer: 'http://localhost/en/quiz/x' },
      body: JSON.stringify({ tokens: [TOKEN], reviewOptInTokens: [TOKEN] }),
    });
    await POST(req, routeContext);
    expect(optInMock).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  it('records no opt-in without reviewOptInTokens', async () => {
    await POST(request({ tokens: [TOKEN] }), routeContext);
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('ignores an opt-in token that is not among the claimed ones', async () => {
    const response = await POST(
      request({ tokens: [TOKEN], reviewOptInTokens: [OTHER] }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('still returns 200 with the claim when the opt-in fails', async () => {
    optInMock.mockRejectedValueOnce(new Error('attempt_too_old'));
    const response = await POST(
      request({ tokens: [TOKEN], reviewOptInTokens: [TOKEN] }),
      routeContext,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { claimedAttemptIds: ['attempt-1'], reviewOptInAttemptIds: [] },
    });
  });

  it('returns 429 over the per-user limit', async () => {
    rateMock.mockResolvedValueOnce(DENIED);
    expect((await POST(request({ tokens: [TOKEN] }), routeContext)).status).toBe(429);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it('returns 429 over the per-IP limit', async () => {
    rateMock.mockResolvedValueOnce(ALLOWED).mockResolvedValueOnce(DENIED);
    expect((await POST(request({ tokens: [TOKEN] }), routeContext)).status).toBe(429);
    expect(rateMock).toHaveBeenLastCalledWith('attempt_claim_ip', '203.0.113.7');
    expect(claimMock).not.toHaveBeenCalled();
  });

  it('returns 500 without logging the tokens when the claim fails', async () => {
    claimMock.mockRejectedValueOnce(new Error(`E11000 dup key ${TOKEN}`));
    const response = await POST(request({ tokens: [TOKEN] }), routeContext);
    expect(response.status).toBe(500);
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(TOKEN);
  });
});
