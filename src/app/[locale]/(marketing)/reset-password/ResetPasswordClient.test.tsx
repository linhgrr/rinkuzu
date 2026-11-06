import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { ResetPasswordClient } from './ResetPasswordClient';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=reset-token'),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    prefetch: _prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('@/features/auth/api/auth-api', () => ({ resetPassword: mocks.resetPassword }));

async function submitNewPassword(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('password'), 'Fresh-Passw0rd!');
  await user.type(screen.getByLabelText('confirmPassword'), 'Fresh-Passw0rd!');
  await user.click(screen.getByRole('button', { name: 'resetPasswordSubmit' }));
}

describe('ResetPasswordClient (RIN-980: never the server text)', () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset();
  });

  it('shows the localized success copy, not the server message', async () => {
    mocks.resetPassword.mockResolvedValue({
      message: 'Password updated. Please sign in with your new password.',
    });

    render(<ResetPasswordClient />);
    await submitNewPassword();

    expect(await screen.findByText('resetPasswordSuccess')).toBeInTheDocument();
    expect(screen.queryByText(/Password updated/)).not.toBeInTheDocument();
  });

  it('shows the invalid-link copy for an invalid or expired token', async () => {
    mocks.resetPassword.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Invalid or expired token',
        status: 400,
        code: 'invalid_token',
      }),
    );

    render(<ResetPasswordClient />);
    await submitNewPassword();

    expect(await screen.findByText('resetPasswordInvalidToken')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid or expired/)).not.toBeInTheDocument();
  });

  it.each([
    [429, 'Too many requests. Please try again later.', 'errors.api.rateLimited'],
    [500, 'MongoServerError: E11000', 'errors.api.server'],
  ])('shows the shared API copy for HTTP %i', async (status, serverText, expected) => {
    mocks.resetPassword.mockRejectedValue(
      new ApiResponseError({ payload: null, message: serverText, status }),
    );

    render(<ResetPasswordClient />);
    await submitNewPassword();

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(serverText)).not.toBeInTheDocument();
  });

  it('shows the shared network copy when the request never reaches the server', async () => {
    mocks.resetPassword.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<ResetPasswordClient />);
    await submitNewPassword();

    expect(await screen.findByText('errors.api.network')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
