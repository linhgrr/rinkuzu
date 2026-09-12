import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailClient } from './VerifyEmailClient';

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  markSignupPending: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=verification-token'),
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
  });

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
