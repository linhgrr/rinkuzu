import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

describe('getCurrentSession', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
  });

  it('delegates to auth() and returns the session value', async () => {
    const session = {
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
      expires: '2026-07-18T00:00:00.000Z',
    };
    authMock.mockResolvedValue(session);

    const { getCurrentSession } = await import('@/lib/auth/session');
    const result = await getCurrentSession();

    expect(authMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(session);
  });

  it('returns null when auth() has no session', async () => {
    authMock.mockResolvedValue(null);

    const { getCurrentSession } = await import('@/lib/auth/session');
    await expect(getCurrentSession()).resolves.toBeNull();
    expect(authMock).toHaveBeenCalledTimes(1);
  });
});
