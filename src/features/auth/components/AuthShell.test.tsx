// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({
  pathname: '/register',
  push: vi.fn(),
  formCallback: null as string | null,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/image', () => ({ default: () => null }));

vi.mock('@/features/auth/components/LoginForm', () => ({
  LoginForm: () => <p>login-form</p>,
}));
vi.mock('@/features/auth/components/RegisterForm', () => ({
  RegisterForm: ({ onSwitchMode }: { onSwitchMode?: (callbackUrl: string | null) => void }) => (
    <button type="button" onClick={() => onSwitchMode?.(nav.formCallback)}>
      switch-to-login
    </button>
  ),
}));

import { AuthShell } from './AuthShell';

describe('AuthShell mode switch', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.formCallback = null;
  });

  it('keeps the callback the sign-up form hands over when switching to sign-in', async () => {
    nav.formCallback = '/quiz/nhap-mon-ai';
    render(<AuthShell locale="vi" />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'switch-to-login' }));

    expect(nav.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fquiz%2Fnhap-mon-ai');
  });

  it.each([[null], ['//evil.com']])('switches to plain /login for %j', async (callback) => {
    nav.formCallback = callback;
    render(<AuthShell locale="vi" />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'switch-to-login' }));

    expect(nav.push).toHaveBeenCalledWith('/login');
  });
});
