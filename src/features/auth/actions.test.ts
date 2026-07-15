import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock('@/auth', () => ({ signOut: signOutMock }));

import { logout } from '@/features/auth/actions';

describe('Auth.js server actions', () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
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
