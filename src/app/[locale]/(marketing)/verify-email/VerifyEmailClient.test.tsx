import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import {
  CLAIMED_GUEST_DRAFT_STORAGE_KEY,
  readClaimedGuestDraftQuiz,
} from '@/features/quiz/lib/guest-draft-claims';
import { VerifyEmailClient } from './VerifyEmailClient';

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  markSignupPending: vi.fn(),
  search: 'token=verification-token',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
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

vi.mock('@/features/auth/api/auth-api', () => ({ verifyEmail: mocks.verifyEmail }));
vi.mock('@/lib/analytics/client', () => ({
  markAnalyticsSignupPending: mocks.markSignupPending,
}));

describe('VerifyEmailClient', () => {
  beforeEach(() => {
    mocks.verifyEmail.mockReset();
    mocks.markSignupPending.mockReset();
    mocks.search = 'token=verification-token';
    window.localStorage.clear();
  });

  it('remembers the quiz the verification claimed from the guest draft (RIN-1487)', async () => {
    mocks.verifyEmail.mockResolvedValue({ message: 'verified', claimedQuizSlug: 'fake-quiz' });

    render(<VerifyEmailClient />);

    expect(await screen.findByText('verifyEmailSuccess')).toBeInTheDocument();
    expect(readClaimedGuestDraftQuiz()).toBe('fake-quiz');
  });

  it('remembers nothing when the verification claimed no draft', async () => {
    mocks.verifyEmail.mockResolvedValue({ message: 'verified' });

    render(<VerifyEmailClient />);

    expect(await screen.findByText('verifyEmailSuccess')).toBeInTheDocument();
    expect(window.localStorage.getItem(CLAIMED_GUEST_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('sends the verified user to sign in with the callbackUrl from the email link', async () => {
    mocks.search = 'token=verification-token&callbackUrl=%2Fquiz%2Fnhap-mon-ai';
    mocks.verifyEmail.mockResolvedValue({ message: 'verified' });

    render(<VerifyEmailClient />);

    expect(await screen.findByRole('link', { name: 'signIn' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fnhap-mon-ai',
    );
  });

  it.each([['//evil.com'], ['https://evil.com'], ['']])(
    'drops an unsafe callbackUrl %j from the sign-in link',
    async (callbackUrl) => {
      mocks.search = `token=verification-token&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      mocks.verifyEmail.mockResolvedValue({ message: 'verified' });

      render(<VerifyEmailClient />);

      expect(await screen.findByRole('link', { name: 'signIn' })).toHaveAttribute('href', '/login');
    },
  );

  it('marks signup complete only after email verification succeeds', async () => {
    mocks.verifyEmail.mockResolvedValue({ message: 'verified' });

    render(<VerifyEmailClient />);

    expect(await screen.findByText('verifyEmailSuccess')).toBeInTheDocument();
    expect(mocks.markSignupPending).toHaveBeenCalledWith('credentials', 'en');
  });

  it('does not mark signup complete when verification fails', async () => {
    mocks.verifyEmail.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Token 9f2c… not found in auth_tokens',
        status: 400,
        code: 'invalid_token',
      }),
    );

    render(<VerifyEmailClient />);

    expect(await screen.findByText('verifyEmailFailed')).toBeInTheDocument();
    expect(screen.queryByText(/auth_tokens/)).not.toBeInTheDocument();
    expect(mocks.markSignupPending).not.toHaveBeenCalled();
  });

  it('shows the localized success copy, not the server message', async () => {
    mocks.verifyEmail.mockResolvedValue({ message: 'Email verified. You can now sign in.' });

    render(<VerifyEmailClient />);

    expect(await screen.findByText('verifyEmailSuccess')).toBeInTheDocument();
    expect(screen.queryByText('Email verified. You can now sign in.')).not.toBeInTheDocument();
  });

  it('uses the shared API copy when verification is rate limited or the server fails', async () => {
    mocks.verifyEmail.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Too many requests from 10.0.0.1',
        status: 429,
      }),
    );

    const { unmount } = render(<VerifyEmailClient />);

    expect(await screen.findByText('errors.api.rateLimited')).toBeInTheDocument();
    expect(screen.queryByText(/10\.0\.0\.1/)).not.toBeInTheDocument();
    unmount();

    mocks.verifyEmail.mockRejectedValue(
      new ApiResponseError({ payload: null, message: 'MongoServerError: E11000', status: 500 }),
    );
    render(<VerifyEmailClient />);

    expect(await screen.findByText('errors.api.server')).toBeInTheDocument();
    expect(screen.queryByText(/MongoServerError/)).not.toBeInTheDocument();
  });
});
