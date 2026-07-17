import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkAuthRateLimitMock,
  extractRequestContextMock,
  rateLimitResponseMock,
  resendVerificationMock,
} = vi.hoisted(() => ({
  checkAuthRateLimitMock: vi.fn(),
  extractRequestContextMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  resendVerificationMock: vi.fn(),
}));

vi.mock('@/lib/auth-account-factory', () => ({
  getAuthAccountService: () => ({
    resendVerification: resendVerificationMock,
  }),
}));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: checkAuthRateLimitMock,
  rateLimitResponse: rateLimitResponseMock,
}));
vi.mock('@/lib/audit', () => ({ extractRequestContext: extractRequestContextMock }));

import { POST } from '@/app/api/auth/resend-verification/route';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.30' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractRequestContextMock.mockReturnValue({ ip: '198.51.100.30', userAgent: 'vitest' });
    checkAuthRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetSeconds: 3600,
      limit: 3,
    });
    rateLimitResponseMock.mockReturnValue(new Response('limited', { status: 429 }));
    resendVerificationMock.mockResolvedValue({
      success: true,
      data: { accepted: true },
    });
  });

  it('validates input before rate limiting or reissuing a verification token', async () => {
    const response = await POST(request({ email: 'bad' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(checkAuthRateLimitMock).not.toHaveBeenCalled();
    expect(resendVerificationMock).not.toHaveBeenCalled();
  });

  it('rate-limits by normalized email and stops before the service call', async () => {
    const limited = { allowed: false, retryAfterSeconds: 90, limit: 3 } as const;
    checkAuthRateLimitMock.mockResolvedValue(limited);

    const response = await POST(request({ email: '  Learner@Example.com ' }));

    expect(checkAuthRateLimitMock).toHaveBeenCalledWith(
      'resend_verification_email',
      'learner@example.com',
    );
    expect(rateLimitResponseMock).toHaveBeenCalledWith(limited);
    expect(resendVerificationMock).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
  });

  it('returns a neutral success envelope for a valid recent resend request', async () => {
    const response = await POST(request({ email: '  Learner@Example.com ' }));

    expect(resendVerificationMock).toHaveBeenCalledWith('learner@example.com', {
      ip: '198.51.100.30',
      userAgent: 'vitest',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { accepted: true },
      meta: {
        message: 'If the email exists and is unverified, a new verification link has been sent.',
      },
    });
  });

  it('maps service failures without leaking verification tokens', async () => {
    resendVerificationMock.mockResolvedValueOnce({
      success: false,
      code: 'internal_error',
      error: 'Unable to resend',
      statusCode: 500,
    });

    const response = await POST(request({ email: 'user@example.com' }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: 'internal_error' } });
    expect(JSON.stringify(body)).not.toMatch(/token|verify_link|secret/i);
  });
});
