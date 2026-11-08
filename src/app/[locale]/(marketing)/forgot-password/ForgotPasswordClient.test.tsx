import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { ForgotPasswordClient } from './ForgotPasswordClient';

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && 'seconds' in values ? key + ':' + String(values['seconds']) : key,
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

vi.mock('@/features/auth/api/auth-api', () => ({
  requestPasswordReset: mocks.requestPasswordReset,
}));

async function submitEmail(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('emailAddress'), 'learner@example.com');
  await user.click(screen.getByRole('button', { name: 'forgotPasswordSubmit' }));
}

describe('ForgotPasswordClient (RIN-980: never the server text)', () => {
  beforeEach(() => {
    mocks.requestPasswordReset.mockReset();
  });

  it('shows the localized sent copy, not the server message', async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      message: 'If the email exists, a reset link has been sent.',
    });

    render(<ForgotPasswordClient />);
    await submitEmail();

    expect(await screen.findByText('forgotPasswordSent')).toBeInTheDocument();
    expect(screen.queryByText(/a reset link has been sent/)).not.toBeInTheDocument();
  });

  it('counts down like check-email when rate limited', async () => {
    mocks.requestPasswordReset.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Too many requests. Please try again later.',
        status: 429,
        retryAfterSeconds: 42,
      }),
    );

    render(<ForgotPasswordClient />);
    await submitEmail();

    expect(await screen.findByText('rateLimited:42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'resendVerificationCountdown:42' })).toBeDisabled();
    expect(screen.queryByText(/Too many requests/)).not.toBeInTheDocument();
  });

  it('falls back to a 60 s countdown when the 429 has no Retry-After', async () => {
    mocks.requestPasswordReset.mockRejectedValue(
      new ApiResponseError({ payload: null, message: 'Too many requests', status: 429 }),
    );

    render(<ForgotPasswordClient />);
    await submitEmail();

    expect(await screen.findByText('rateLimited:60')).toBeInTheDocument();
  });

  it.each([
    [
      new ApiResponseError({ payload: null, message: 'MongoServerError', status: 500 }),
      'errors.api.server',
    ],
    [new TypeError('Failed to fetch'), 'errors.api.network'],
  ])('shows the shared API copy for %s', async (error, expected) => {
    mocks.requestPasswordReset.mockRejectedValue(error);

    render(<ForgotPasswordClient />);
    await submitEmail();

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
  });
});
