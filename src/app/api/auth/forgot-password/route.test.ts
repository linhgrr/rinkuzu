import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkAuthRateLimitMock,
  extractRequestContextMock,
  rateLimitResponseMock,
  requestPasswordResetMock,
} = vi.hoisted(() => ({
  checkAuthRateLimitMock: vi.fn(),
  extractRequestContextMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
}));

vi.mock('@/lib/auth-account-factory', () => ({
  getAuthAccountService: () => ({
    requestPasswordReset: requestPasswordResetMock,
  }),
}));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: checkAuthRateLimitMock,
  rateLimitResponse: rateLimitResponseMock,
}));
vi.mock('@/lib/audit', () => ({ extractRequestContext: extractRequestContextMock }));

import { POST } from '@/app/api/auth/forgot-password/route';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.20' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractRequestContextMock.mockReturnValue({ ip: '198.51.100.20', userAgent: 'vitest' });
    checkAuthRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetSeconds: 3600,
      limit: 3,
    });
    rateLimitResponseMock.mockReturnValue(new Response('limited', { status: 429 }));
    requestPasswordResetMock.mockResolvedValue({
      success: true,
      data: { accepted: true },
    });
  });

  it('validates input before rate limiting or issuing a reset token', async () => {
    const response = await POST(request({ email: 'not-an-email' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(checkAuthRateLimitMock).not.toHaveBeenCalled();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('rate-limits by normalized email and returns the rate-limit response without sending mail', async () => {
    const limited = { allowed: false, retryAfterSeconds: 120, limit: 3 } as const;
    checkAuthRateLimitMock.mockResolvedValue(limited);

    const response = await POST(request({ email: '  Learner@Example.com ' }));

    expect(checkAuthRateLimitMock).toHaveBeenCalledWith(
      'forgot_password_email',
      'learner@example.com',
    );
    expect(rateLimitResponseMock).toHaveBeenCalledWith(limited);
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
  });

  it('returns a neutral success envelope after a recent valid request', async () => {
    const response = await POST(request({ email: '  Learner@Example.com ' }));

    expect(requestPasswordResetMock).toHaveBeenCalledWith('learner@example.com', {
      ip: '198.51.100.20',
      userAgent: 'vitest',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { accepted: true },
      meta: {
        message: 'If the email exists in our system, a reset link has been sent. Check your inbox.',
      },
    });
  });

  it('maps service failures without leaking token material', async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      success: false,
      code: 'rate_limited',
      error: 'Too many reset requests',
      statusCode: 429,
    });

    const response = await POST(request({ email: 'user@example.com' }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: 'rate_limited' } });
    expect(JSON.stringify(body)).not.toMatch(/token|reset_link|secret/i);
  });
});
