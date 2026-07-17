import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAuthTokenActionRouteMock, resetPasswordMock } = vi.hoisted(() => ({
  createAuthTokenActionRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
  resetPasswordMock: vi.fn(),
}));

vi.mock('@/app/api/auth/token-action-route', () => ({
  createAuthTokenActionRoute: createAuthTokenActionRouteMock,
}));
vi.mock('@/lib/auth-account-factory', () => ({
  getAuthAccountService: () => ({
    resetPassword: resetPasswordMock,
  }),
}));

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthTokenActionRouteMock.mockClear();
    resetPasswordMock.mockReset();
    resetPasswordMock.mockResolvedValue({ success: true, data: { reset: true } });
  });

  it('configures token validation, IP rate limiting, and password reset execution', async () => {
    const route = await import('@/app/api/auth/reset-password/route');

    expect(createAuthTokenActionRouteMock).toHaveBeenCalledTimes(1);
    const options = createAuthTokenActionRouteMock.mock.calls[0]?.[0] as
      | {
          schema: { safeParse: (value: unknown) => { success: boolean } };
          rateLimitAction: string;
          rateLimitKey: (
            input: { token: string; password: string },
            context: { ip: string | null },
          ) => string;
          execute: (
            input: { token: string; password: string },
            context: { ip: string | null; userAgent: string | null },
          ) => Promise<unknown>;
          successMessage: string;
        }
      | undefined;
    expect(options).toBeDefined();
    if (!options) throw new Error('expected reset-password route options');

    // Module reload can produce a distinct schema instance with the same contract.
    expect(options.schema.safeParse({ token: 'a'.repeat(32), password: 'password1' }).success).toBe(
      true,
    );
    expect(options.schema.safeParse({ token: 'short', password: 'password1' }).success).toBe(false);
    expect(options.rateLimitAction).toBe('reset_password_token_ip');
    expect(options.successMessage).toBe('Password updated. Please sign in with your new password.');
    expect(options.rateLimitKey({ token: 't', password: 'p' }, { ip: '198.51.100.4' })).toBe(
      '198.51.100.4',
    );
    expect(options.rateLimitKey({ token: 't', password: 'p' }, { ip: null })).toBe('unknown');

    const context = { ip: '198.51.100.4', userAgent: 'vitest' };
    await options.execute({ token: 'a'.repeat(32), password: 'password1' }, context);
    expect(resetPasswordMock).toHaveBeenCalledWith('a'.repeat(32), 'password1', context);

    expect(route.POST).toBeTypeOf('function');
    expect(createAuthTokenActionRouteMock.mock.results[0]?.value).toBe(route.POST);
  });
});
