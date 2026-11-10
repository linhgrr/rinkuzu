/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../messages/en/create.json';
import viCreate from '../../../../messages/vi/create.json';
import { GuestCreateHubPage } from './GuestCreateHubPage';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

const messages = { en: { create: enCreate }, vi: { create: viCreate } } as const;

function renderHub(locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestCreateHubPage />
    </NextIntlClientProvider>,
  );
}

describe('GuestCreateHubPage (RIN-1473)', () => {
  it.each([
    [
      'vi',
      'Tạo quiz',
      'Thử với PDF của bạn',
      'Thử với PDF của bạn – không cần tài khoản',
      'Đã có tài khoản?',
      'Đăng nhập',
      'Tạo tài khoản',
    ],
    [
      'en',
      'Create a quiz',
      'Try it with your own PDF',
      'Try it with your own PDF, no account needed',
      'Already have an account?',
      'Sign in',
      'Create an account',
    ],
  ] as const)(
    'leads a signed-out %s visitor to the guest PDF trial first, sign-in second',
    (locale, title, cardA, cta, cardB, signIn, register) => {
      renderHub(locale);

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      const [first, second] = screen.getAllByRole('heading', { level: 2 });
      expect(first).toHaveTextContent(cardA);
      expect(second).toHaveTextContent(cardB);

      expect(screen.getByRole('link', { name: cta })).toHaveAttribute(
        'href',
        '/try/pdf?entry=create',
      );
      expect(screen.getByRole('link', { name: signIn })).toHaveAttribute(
        'href',
        '/login?callbackUrl=%2Fcreate',
      );
      expect(screen.getByRole('link', { name: register })).toHaveAttribute(
        'href',
        '/register?callbackUrl=%2Fcreate',
      );
    },
  );

  it('names the real trial limits, not the spec draft numbers', () => {
    renderHub('en');

    expect(
      screen.getByText(
        'Upload a PDF (up to 10 pages, 4 MB) and play the quiz right away, no account needed.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no drafts section and calls no account API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderHub('vi');

    expect(screen.queryByRole('heading', { name: /bản nháp/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('puts the trial card before the account card, full-width CTA on mobile', () => {
    renderHub('en');

    const section = screen.getByRole('region', { name: 'Choose how to create your quiz' });
    const cta = within(section).getByRole('link', { name: /no account needed/ });
    expect(cta.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['btn', 'btn-primary', 'w-full', 'whitespace-normal']),
    );
    expect(section.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']),
    );
  });

  it('has no axe violations', async () => {
    const { container } = renderHub('vi');

    expect((await axe(container)).violations).toEqual([]);
  });
});
