import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, signOutMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock, signOut: signOutMock }));

import { logout } from '@/features/auth/actions';

describe('Auth.js server actions', () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } });
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
  });

  it('fails closed without a session', async () => {
    authMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set('locale', 'en');

    await logout(formData);

    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('signs out to the locale-prefixed public home', async () => {
    const formData = new FormData();
    formData.set('locale', 'en');

    await logout(formData);

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/en' });
  });

  it('fails closed to the default locale for malformed input', async () => {
    const formData = new FormData();
    formData.set('locale', 'malicious-locale');

    await logout(formData);

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/vi' });
  });
});
