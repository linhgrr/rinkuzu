import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, claimMock, loggerErrorMock, rateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  claimMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  rateMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: rateMock,
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/guest-attempt-claim-factory', () => ({
  getGuestAttemptClaimService: () => ({ claim: claimMock }),
}));

import { dynamic, POST } from '@/app/api/attempts/claim/route';

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
    claimMock.mockResolvedValue(['attempt-1']);
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
      data: { claimedAttemptIds: ['attempt-1'] },
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
      data: { claimedAttemptIds: [] },
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
