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

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      ...headers,
    },
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

  // RIN-1310: the browser's guest claim tokens travel with the sign-up.
  it('forwards the guest claim tokens to the account service', async () => {
    const token = 'A'.repeat(43);
    const response = await POST(
      request({ ...validBody, guestClaimTokens: [token], guestDraftTokens: [token] }),
    );

    expect(response.status).toBe(201);
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ guestClaimTokens: [token], guestDraftTokens: [token] }),
      expect.anything(),
    );
  });

  it('rejects a malformed guest claim token', async () => {
    const response = await POST(request({ ...validBody, guestClaimTokens: ['short'] }));

    expect(response.status).toBe(400);
    expect(registerMock).not.toHaveBeenCalled();
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
      code: 'registration_method_mismatch',
      error: 'Registration method does not match the existing account',
      statusCode: 409,
    });
    const failed = await POST(request(validBody));
    expect(failed.status).toBe(409);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'registration_method_mismatch' },
    });
  });

  it('stores the locale of the signup page: en on /en, vi on /vi (RIN-1263)', async () => {
    await POST(request({ ...validBody, locale: 'en' }));
    expect(registerMock.mock.calls[0]?.[0]).toMatchObject({ locale: 'en' });

    await POST(request({ ...validBody, locale: 'vi' }));
    expect(registerMock.mock.calls[1]?.[0]).toMatchObject({ locale: 'vi' });
  });

  it('falls back to the posting page, then the locale cookie, and drops unknown locales', async () => {
    await POST(
      request({ ...validBody, locale: 'fr' }, { referer: 'http://localhost/en/register' }),
    );
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock.mock.calls[0]?.[0]).toMatchObject({ locale: 'en' });

    await POST(request(validBody, { cookie: 'NEXT_LOCALE=en' }));
    expect(registerMock.mock.calls[1]?.[0]).toMatchObject({ locale: 'en' });

    await POST(request({ ...validBody, locale: 'fr' }));
    expect(registerMock.mock.calls[2]?.[0]).not.toHaveProperty('locale');
  });

  it('passes the edge country of the signup request (RIN-1268)', async () => {
    await POST(request(validBody, { 'x-vercel-ip-country': 'JP' }));
    expect(registerMock.mock.calls[0]?.[0]).toMatchObject({ signupCountry: 'JP' });
  });

  it('passes no country when the header is missing, unknown or malformed', async () => {
    await POST(request(validBody));
    await POST(request(validBody, { 'x-vercel-ip-country': 'XX' }));
    await POST(request(validBody, { 'x-vercel-ip-country': 'jp' }));
    for (const call of registerMock.mock.calls) {
      expect(call[0]).not.toHaveProperty('signupCountry');
    }
  });

  it('falls back to unknown when the request has no IP', async () => {
    extractRequestContextMock.mockReturnValue({ ip: null, userAgent: null });

    await POST(request(validBody));

    expect(checkAuthRateLimitMock).toHaveBeenCalledWith('register_ip', 'unknown');
  });
});
