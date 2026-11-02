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

vi.mock('@/features/auth/api/auth-api', () => ({
  registerAccount: vi.fn(),
}));

vi.mock('@/features/auth/components/GoogleAuthButton', () => ({
  GoogleAuthButton: ({ onBeforeSignIn }: { onBeforeSignIn?: () => void }) => (
    <button type="button" onClick={onBeforeSignIn}>
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
