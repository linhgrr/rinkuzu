import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(mocks.markSignupPending).toHaveBeenCalledWith('credentials', 'en');
  });

  it('does not mark signup complete when verification fails', async () => {
    mocks.verifyEmail.mockRejectedValue(new Error('invalid token'));

    render(<VerifyEmailClient />);

    expect(await screen.findByText('invalid token')).toBeInTheDocument();
    expect(mocks.markSignupPending).not.toHaveBeenCalled();
  });
});
