import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentSessionMock, redirectMock } = vi.hoisted(() => ({
  getCurrentSessionMock: vi.fn(),
  redirectMock: vi.fn((target: unknown): never => {
    throw new Error(`redirect:${JSON.stringify(target)}`);
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: getCurrentSessionMock,
}));

vi.mock('@/i18n/navigation', () => ({
  redirect: redirectMock,
}));

import AdminLayout from './layout';

function renderLayout(children: ReactNode = 'admin content') {
  return AdminLayout({ children, params: Promise.resolve({ locale: 'vi' }) });
}

describe('AdminLayout server authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a missing or DB-revoked session to login', async () => {
    getCurrentSessionMock.mockResolvedValue(null);

    await expect(renderLayout()).rejects.toThrow(
      'redirect:{"href":{"pathname":"/login","query":{"callbackUrl":"/admin/users"}},"locale":"vi"}',
    );
  });

  it('redirects a current non-admin session away from the admin tree', async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    await expect(renderLayout()).rejects.toThrow('redirect:{"href":"/","locale":"vi"}');
  });

  it('renders the admin tree only for a current DB-validated admin', async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });

    await expect(renderLayout('protected admin content')).resolves.toBe('protected admin content');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
