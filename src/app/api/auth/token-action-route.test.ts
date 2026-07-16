import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { checkAuthRateLimitMock, extractRequestContextMock, rateLimitResponseMock } = vi.hoisted(
  () => ({
    checkAuthRateLimitMock: vi.fn(),
    extractRequestContextMock: vi.fn(),
    rateLimitResponseMock: vi.fn(),
  }),
);

vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: checkAuthRateLimitMock,
  rateLimitResponse: rateLimitResponseMock,
}));
vi.mock('@/lib/audit', () => ({ extractRequestContext: extractRequestContextMock }));

import { createAuthTokenActionRoute } from '@/app/api/auth/token-action-route';

const schema = z.object({ token: z.string().min(1) });
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/token-action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  });

describe('createAuthTokenActionRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractRequestContextMock.mockReturnValue({ ip: '127.0.0.1', userAgent: 'test-agent' });
    checkAuthRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetSeconds: 60,
      limit: 10,
    });
    rateLimitResponseMock.mockReturnValue(new Response('limited', { status: 429 }));
  });

  it('validates, rate-limits, and executes with the request context', async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: { verified: true } });
    const route = createAuthTokenActionRoute({
      schema,
      rateLimitAction: 'verify_email_ip',
      rateLimitKey: (input, context) => `${context.ip}:${input.token}`,
      execute,
      successMessage: 'Done',
    });

    const response = await route(request({ token: 'token-1' }));

    expect(response.status).toBe(200);
    expect(checkAuthRateLimitMock).toHaveBeenCalledWith('verify_email_ip', '127.0.0.1:token-1');
    expect(execute).toHaveBeenCalledWith(
      { token: 'token-1' },
      { ip: '127.0.0.1', userAgent: 'test-agent' },
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      meta: { message: 'Done' },
    });
  });

  it('stops before rate limiting when the body is invalid', async () => {
    const execute = vi.fn();
    const route = createAuthTokenActionRoute({
      schema,
      rateLimitAction: 'verify_email_ip',
      rateLimitKey: () => 'key',
      execute,
      successMessage: 'Done',
    });

    const response = await route(request({ token: '' }));

    expect(response.status).toBe(400);
    expect(checkAuthRateLimitMock).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns the rate-limit response without executing the service', async () => {
    const limited = { allowed: false, retryAfterSeconds: 30, limit: 10 } as const;
    checkAuthRateLimitMock.mockResolvedValue(limited);
    const execute = vi.fn();
    const route = createAuthTokenActionRoute({
      schema,
      rateLimitAction: 'verify_email_ip',
      rateLimitKey: () => 'key',
      execute,
      successMessage: 'Done',
    });

    const response = await route(request({ token: 'token-1' }));

    expect(response.status).toBe(429);
    expect(rateLimitResponseMock).toHaveBeenCalledWith(limited);
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps service failures to the standard API error response', async () => {
    const route = createAuthTokenActionRoute({
      schema,
      rateLimitAction: 'verify_email_ip',
      rateLimitKey: () => 'key',
      execute: vi.fn().mockResolvedValue({
        success: false,
        code: 'token_invalid',
        error: 'Token invalid',
        statusCode: 422,
      }),
      successMessage: 'Done',
    });

    const response = await route(request({ token: 'token-1' }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'token_invalid' } });
  });
});
