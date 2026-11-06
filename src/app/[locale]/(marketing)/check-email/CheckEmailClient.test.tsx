import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { CheckEmailClient } from './CheckEmailClient';

const mocks = vi.hoisted(() => ({
  resendVerificationEmail: vi.fn(),
  search: 'email=learner%40example.com',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
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

vi.mock('@/features/auth/api/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api/auth-api')>()),
  resendVerificationEmail: mocks.resendVerificationEmail,
}));

async function resend(): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name: 'resendVerification' }));
}

describe('CheckEmailClient (RIN-980: never the server text)', () => {
  beforeEach(() => {
    mocks.resendVerificationEmail.mockReset();
    mocks.search = 'email=learner%40example.com';
  });

  it('shows the localized resent copy, not the server message', async () => {
    mocks.resendVerificationEmail.mockResolvedValue({
      message: 'If the account exists, a verification email was sent.',
    });

    render(<CheckEmailClient />);
    await resend();

    expect(await screen.findByText('checkEmailResent')).toBeInTheDocument();
    expect(screen.queryByText(/a verification email was sent/)).not.toBeInTheDocument();
  });

  it.each([
    [
      new ApiResponseError({ payload: null, message: 'MongoServerError', status: 500 }),
      'errors.api.server',
    ],
    [
      new ApiResponseError({
        payload: null,
        message: 'Invalid email address',
        status: 400,
        code: 'validation_error',
      }),
      'errors.api.validation',
    ],
    [new TypeError('Failed to fetch'), 'errors.api.network'],
  ])('shows the shared API copy for %s', async (error, expected) => {
    mocks.resendVerificationEmail.mockRejectedValue(error);

    render(<CheckEmailClient />);
    await resend();

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
  });
});

describe('CheckEmailClient (RIN-1048: hint when the address is unknown)', () => {
  beforeEach(() => {
    mocks.resendVerificationEmail.mockReset();
  });

  it('asks the learner to type their address when the link carried no email', () => {
    mocks.search = '';

    render(<CheckEmailClient />);

    expect(screen.getByText('checkEmailTypeAddressHint')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('checkEmailTypeAddressHint');
  });

  it('prefills the field and shows no hint when the email is in the URL', () => {
    mocks.search = 'email=Learner%40Example.com';

    render(<CheckEmailClient />);

    expect(screen.queryByText('checkEmailTypeAddressHint')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('learner@example.com');
  });
});
