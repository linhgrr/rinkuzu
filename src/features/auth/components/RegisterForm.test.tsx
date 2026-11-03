// @vitest-environment jsdom

import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));

const navigationMock = vi.hoisted(() => ({ search: '' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigationMock.search),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const registerAccountMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/auth/api/auth-api', () => ({
  registerAccount: registerAccountMock,
}));

vi.mock('@/features/auth/components/GoogleAuthButton', () => ({
  GoogleAuthButton: ({
    onBeforeSignIn,
    callbackUrl,
  }: {
    onBeforeSignIn?: () => void;
    callbackUrl: string;
  }) => (
    <button type="button" onClick={onBeforeSignIn} data-callback-url={callbackUrl}>
      mock-google-button
    </button>
  ),
}));

async function renderRegisterForm() {
  const { RegisterForm } = await import('@/features/auth/components/RegisterForm');
  return render(<RegisterForm locale="en" googleEnabled />);
}

describe('RegisterForm Google sign-up analytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    navigationMock.search = '';
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST123');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');
  });

  it('fires signup_started and marks the Google auth pending when consent is granted', async () => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
    const user = userEvent.setup();
    await renderRegisterForm();

    await user.click(screen.getByRole('button', { name: 'mock-google-button' }));

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'signup_started',
      expect.objectContaining({ method: 'google', locale: 'en' }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
    // signup vs. login is decided on return from the server's isNewAccount flag.
    expect(window.sessionStorage.getItem('rinkuzu_analytics_pending_login_v1')).toEqual(
      expect.stringContaining('"method":"google"'),
    );
    expect(window.localStorage.getItem('rinkuzu_analytics_pending_signup_v1')).toBeNull();
  });

  it('does not capture or mark anything when consent has been withheld', async () => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
    const user = userEvent.setup();
    await renderRegisterForm();

    await user.click(screen.getByRole('button', { name: 'mock-google-button' }));

    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('rinkuzu_analytics_pending_login_v1')).toBeNull();
  });
});

describe('RegisterForm callbackUrl', () => {
  const credentials = { email: 'learner@example.com', password: 'Str0ng-Passw0rd!' };

  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.search = '';
    registerAccountMock.mockResolvedValue({ message: 'check your inbox' });
  });

  async function renderVi() {
    const { RegisterForm } = await import('@/features/auth/components/RegisterForm');
    return render(<RegisterForm locale="vi" googleEnabled />);
  }

  async function submitValidForm() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('emailAddress'), credentials.email);
    await user.type(screen.getByLabelText('password'), credentials.password);
    await user.type(screen.getByLabelText('confirmPassword'), credentials.password);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'createAccountButton' }));
    await screen.findByText('check your inbox');
  }

  it('carries a safe callbackUrl into Google, the sign-in link and the verification email', async () => {
    navigationMock.search = 'callbackUrl=%2Fquiz%2Fnhap-mon-ai';
    await renderVi();

    expect(screen.getByRole('button', { name: 'mock-google-button' })).toHaveAttribute(
      'data-callback-url',
      '/vi/quiz/nhap-mon-ai',
    );
    expect(screen.getByRole('link', { name: 'signIn' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fnhap-mon-ai',
    );

    await submitValidForm();
    expect(registerAccountMock).toHaveBeenCalledWith({
      ...credentials,
      callbackUrl: '/quiz/nhap-mon-ai',
    });
  });

  it('keeps the dashboard when there is no callbackUrl', async () => {
    await renderVi();

    expect(screen.getByRole('button', { name: 'mock-google-button' })).toHaveAttribute(
      'data-callback-url',
      '/vi/dashboard',
    );
    expect(screen.getByRole('link', { name: 'signIn' })).toHaveAttribute('href', '/login');

    await submitValidForm();
    expect(registerAccountMock).toHaveBeenCalledWith(credentials);
  });

  it.each([['//evil.com'], ['https://evil.com'], ['/vi/register']])(
    'falls back to the dashboard for an unsafe callbackUrl %j',
    async (callbackUrl) => {
      navigationMock.search = `callbackUrl=${encodeURIComponent(callbackUrl)}`;
      await renderVi();

      expect(screen.getByRole('button', { name: 'mock-google-button' })).toHaveAttribute(
        'data-callback-url',
        '/vi/dashboard',
      );
      expect(screen.getByRole('link', { name: 'signIn' })).toHaveAttribute('href', '/login');

      await submitValidForm();
      expect(registerAccountMock).toHaveBeenCalledWith(credentials);
    },
  );
});
