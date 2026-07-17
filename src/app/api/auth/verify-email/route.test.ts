import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAuthTokenActionRouteMock, verifyEmailMock } = vi.hoisted(() => ({
  createAuthTokenActionRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
  verifyEmailMock: vi.fn(),
}));

vi.mock('@/app/api/auth/token-action-route', () => ({
  createAuthTokenActionRoute: createAuthTokenActionRouteMock,
}));
vi.mock('@/lib/auth-account-factory', () => ({
  getAuthAccountService: () => ({
    verifyEmail: verifyEmailMock,
  }),
}));

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthTokenActionRouteMock.mockClear();
    verifyEmailMock.mockReset();
    verifyEmailMock.mockResolvedValue({ success: true, data: { verified: true } });
  });

  it('configures token validation, IP rate limiting, and email verification execution', async () => {
    const route = await import('@/app/api/auth/verify-email/route');

    expect(createAuthTokenActionRouteMock).toHaveBeenCalledTimes(1);
    const options = createAuthTokenActionRouteMock.mock.calls[0]?.[0] as
      | {
          schema: { safeParse: (value: unknown) => { success: boolean } };
          rateLimitAction: string;
          rateLimitKey: (input: { token: string }, context: { ip: string | null }) => string;
          execute: (
            input: { token: string },
            context: { ip: string | null; userAgent: string | null },
          ) => Promise<unknown>;
          successMessage: string;
        }
      | undefined;
    expect(options).toBeDefined();
    if (!options) throw new Error('expected verify-email route options');

    // Module reload can produce a distinct schema instance with the same contract.
    expect(options.schema.safeParse({ token: 'b'.repeat(32) }).success).toBe(true);
    expect(options.schema.safeParse({ token: '' }).success).toBe(false);
    expect(options.rateLimitAction).toBe('verify_email_ip');
    expect(options.successMessage).toBe('Email verified. You can now sign in.');
    expect(options.rateLimitKey({ token: 't' }, { ip: '192.0.2.10' })).toBe('192.0.2.10');
    expect(options.rateLimitKey({ token: 't' }, { ip: null })).toBe('unknown');

    const context = { ip: '192.0.2.10', userAgent: 'vitest' };
    await options.execute({ token: 'b'.repeat(32) }, context);
    expect(verifyEmailMock).toHaveBeenCalledWith('b'.repeat(32), context);

    expect(route.POST).toBeTypeOf('function');
    expect(createAuthTokenActionRouteMock.mock.results[0]?.value).toBe(route.POST);
  });
});
