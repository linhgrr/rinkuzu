import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerMock, checkAuthRateLimitMock, extractRequestContextMock, rateLimitResponseMock } =
  vi.hoisted(() => ({
    registerMock: vi.fn(),
    checkAuthRateLimitMock: vi.fn(),
    extractRequestContextMock: vi.fn(),
    rateLimitResponseMock: vi.fn(),
  }));

vi.mock('@/lib/auth-account-factory', () => ({
  getAuthAccountService: () => ({
    register: registerMock,
  }),
}));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: checkAuthRateLimitMock,
  rateLimitResponse: rateLimitResponseMock,
}));
vi.mock('@/lib/audit', () => ({ extractRequestContext: extractRequestContextMock }));

import { POST } from '@/app/api/auth/register/route';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: 'Learner@Example.com',
  password: 'password1',
  displayName: 'Learner',
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractRequestContextMock.mockReturnValue({ ip: '203.0.113.10', userAgent: 'vitest' });
    checkAuthRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetSeconds: 60,
      limit: 5,
    });
    rateLimitResponseMock.mockReturnValue(new Response('limited', { status: 429 }));
    registerMock.mockResolvedValue({
      success: true,
      data: { email: 'learner@example.com' },
    });
  });

  it('validates input before rate limiting or registering', async () => {
    const response = await POST(request({ email: 'not-an-email', password: 'short' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(checkAuthRateLimitMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('rate-limits by IP and returns the rate-limit response without registering', async () => {
    const limited = { allowed: false, retryAfterSeconds: 30, limit: 5 } as const;
    checkAuthRateLimitMock.mockResolvedValue(limited);

    const response = await POST(request(validBody));

    expect(checkAuthRateLimitMock).toHaveBeenCalledWith('register_ip', '203.0.113.10');
    expect(rateLimitResponseMock).toHaveBeenCalledWith(limited);
    expect(registerMock).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
  });

  it('registers with normalized fields and returns the neutral success envelope', async () => {
    const response = await POST(request(validBody));

    expect(registerMock).toHaveBeenCalledWith(
      {
        email: 'learner@example.com',
        password: 'password1',
        displayName: 'Learner',
      },
      { ip: '203.0.113.10', userAgent: 'vitest' },
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { email: 'learner@example.com' },
      meta: {
        message: 'If the email is valid, a verification link has been sent. Check your inbox.',
      },
    });
  });

  it('omits displayName when absent and maps service failures', async () => {
    await POST(request({ email: 'user@example.com', password: 'password1' }));
    expect(registerMock).toHaveBeenCalledWith(
      {
        email: 'user@example.com',
        password: 'password1',
      },
      expect.any(Object),
    );
    expect(registerMock.mock.calls[0]?.[0]).not.toHaveProperty('displayName');

    registerMock.mockResolvedValueOnce({
      success: false,
      code: 'email_taken',
      error: 'Email already registered',
      statusCode: 409,
    });
    const failed = await POST(request(validBody));
    expect(failed.status).toBe(409);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'email_taken' },
    });
  });

  it('falls back to unknown when the request has no IP', async () => {
    extractRequestContextMock.mockReturnValue({ ip: null, userAgent: null });

    await POST(request(validBody));

    expect(checkAuthRateLimitMock).toHaveBeenCalledWith('register_ip', 'unknown');
  });
});
