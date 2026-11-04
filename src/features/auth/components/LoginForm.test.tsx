import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/LoginForm';

const {
  markAnalyticsGoogleAuthPendingMock,
  markAnalyticsLoginPendingMock,
  replaceBrowserLocationMock,
  searchParamsMock,
  signInMock,
} = vi.hoisted(() => ({
  markAnalyticsGoogleAuthPendingMock: vi.fn(),
  markAnalyticsLoginPendingMock: vi.fn(),
  replaceBrowserLocationMock: vi.fn(),
  searchParamsMock: vi.fn(() => new URLSearchParams('callbackUrl=/explore?type=mine')),
  signInMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: signInMock,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: searchParamsMock,
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

vi.mock('@/features/auth/components/GoogleAuthButton', () => ({
  GoogleAuthButton: ({ onBeforeSignIn }: { onBeforeSignIn?: () => void }) => (
    <button type="button" onClick={onBeforeSignIn}>
      mock-google-button
    </button>
  ),
}));

vi.mock('@/lib/analytics/client', () => ({
  markAnalyticsGoogleAuthPending: markAnalyticsGoogleAuthPendingMock,
  markAnalyticsLoginPending: markAnalyticsLoginPendingMock,
}));

vi.mock('@/lib/routing/browser-navigation', () => ({
  replaceBrowserLocation: replaceBrowserLocationMock,
}));

describe('LoginForm', () => {
  beforeEach(() => {
    markAnalyticsGoogleAuthPendingMock.mockReset();
    markAnalyticsLoginPendingMock.mockReset();
    replaceBrowserLocationMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams('callbackUrl=/explore?type=mine'));
    signInMock.mockReset();
  });

  it('shows why a replaced session returned the user to login', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('reason=session_replaced'));

    render(<LoginForm locale="en" />);

    expect(screen.getByRole('alert')).toHaveTextContent('sessionReplaced');
  });

  it('announces validation errors and does not submit invalid credentials', async () => {
    const user = userEvent.setup();
    render(<LoginForm locale="en" />);

    await user.click(screen.getByRole('button', { name: 'signInButton' }));

    expect(await screen.findByText('invalidEmailFormat')).toBeInTheDocument();
    expect(screen.getByText('passwordRequired')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'emailAddress' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('lets the user reveal and hide their password', async () => {
    const user = userEvent.setup();
    render(<LoginForm locale="en" />);
    const password = screen.getByLabelText('password');

    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'hidePassword' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('submits normalized credentials and hard-navigates to the server-validated URL', async () => {
    signInMock.mockResolvedValue({
      error: undefined,
      ok: true,
      status: 200,
      url: '/en/explore?type=mine',
    });
    const user = userEvent.setup();
    render(<LoginForm locale="en" />);

    await user.type(screen.getByRole('textbox', { name: 'emailAddress' }), 'USER@Example.com');
    await user.type(screen.getByLabelText('password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'signInButton' }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'user@example.com',
        password: 'secret',
        redirect: false,
        callbackUrl: '/en/explore?type=mine',
      });
    });
    expect(markAnalyticsLoginPendingMock).toHaveBeenCalledWith('credentials', 'en');
    expect(replaceBrowserLocationMock).toHaveBeenCalledOnce();
    expect(replaceBrowserLocationMock).toHaveBeenCalledWith('/en/explore?type=mine');
    expect(screen.getByRole('button', { name: 'signingIn' })).toBeDisabled();
  });

  it('shows an accessible error when the credentials are rejected', async () => {
    signInMock.mockResolvedValue({
      error: 'CredentialsSignin',
      ok: false,
      status: 401,
      url: null,
    });
    const user = userEvent.setup();
    render(<LoginForm locale="en" />);

    await user.type(screen.getByRole('textbox', { name: 'emailAddress' }), 'user@example.com');
    await user.type(screen.getByLabelText('password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'signInButton' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalidEmailPassword');
    expect(replaceBrowserLocationMock).not.toHaveBeenCalled();
  });

  async function submitCredentials() {
    const user = userEvent.setup();
    render(<LoginForm locale="en" />);
    await user.type(screen.getByRole('textbox', { name: 'emailAddress' }), 'user@example.com');
    await user.type(screen.getByLabelText('password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'signInButton' }));
  }

  it('shows the localized rate-limit copy when sign-in is throttled (429)', async () => {
    signInMock.mockResolvedValue({
      error: 'CredentialsSignin',
      code: 'rate_limit_exceeded',
      ok: false,
      status: 401,
      url: null,
    });

    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.rateLimited');
    expect(replaceBrowserLocationMock).not.toHaveBeenCalled();
  });

  it('shows the localized server copy when the auth server fails (500)', async () => {
    signInMock.mockResolvedValue({
      error: 'Configuration',
      ok: false,
      status: 500,
      url: null,
    });

    await submitCredentials();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errors.api.server');
    expect(alert).not.toHaveTextContent('Configuration');
    // Field-level validation stays untouched by server errors.
    expect(screen.getByRole('textbox', { name: 'emailAddress' })).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('marks a pending Google auth before redirecting to OAuth', async () => {
    const user = userEvent.setup();
    render(<LoginForm locale="en" googleEnabled />);

    await user.click(screen.getByRole('button', { name: 'mock-google-button' }));

    expect(markAnalyticsGoogleAuthPendingMock).toHaveBeenCalledWith('en');
    expect(markAnalyticsLoginPendingMock).not.toHaveBeenCalled();
  });
});
