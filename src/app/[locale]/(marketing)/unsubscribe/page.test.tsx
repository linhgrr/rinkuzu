import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ unsubscribeLinkState: vi.fn(), loggerError: vi.fn() }));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/communication/review-reminder', () => ({
  unsubscribeLinkState: mocks.unsubscribeLinkState,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import UnsubscribePage from './page';

const TOKEN = '6a8ed209f04328ac17443d91.study_reminders.sig';

async function renderPage(query: { t?: string; result?: string }) {
  render(
    await UnsubscribePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve(query),
    }),
  );
}

describe('/[locale]/unsubscribe (RIN-915)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valid link: confirm-only, one button that POSTs the token with the locale', async () => {
    mocks.unsubscribeLinkState.mockResolvedValue('subscribed');
    await renderPage({ t: TOKEN });

    expect(screen.getByRole('heading', { name: 'confirmTitle' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'confirmButton' });
    const form = button.closest('form');
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('action', `/api/unsubscribe?t=${encodeURIComponent(TOKEN)}`);
    expect(form?.querySelector('input[name="locale"]')).toHaveValue('en');
  });

  it('already unsubscribed: success copy, no button', async () => {
    mocks.unsubscribeLinkState.mockResolvedValue('unsubscribed');
    await renderPage({ t: TOKEN });

    expect(screen.getByRole('heading', { name: 'doneTitle' })).toBeInTheDocument();
    expect(screen.getByText('doneDescription')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute('href', '/');
  });

  it('tampered or missing token: generic invalid page, no form', async () => {
    mocks.unsubscribeLinkState.mockResolvedValue('invalid');
    await renderPage({});

    expect(screen.getByRole('heading', { name: 'invalidTitle' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('server error: generic retry message with the button again', async () => {
    mocks.unsubscribeLinkState.mockRejectedValue(new Error('db down'));
    await renderPage({ t: TOKEN });

    expect(screen.getByRole('heading', { name: 'errorTitle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retryButton' })).toBeInTheDocument();
  });

  it('a failed POST that left the learner subscribed shows the retry state', async () => {
    mocks.unsubscribeLinkState.mockResolvedValue('subscribed');
    await renderPage({ t: TOKEN, result: 'error' });

    expect(screen.getByRole('heading', { name: 'errorTitle' })).toBeInTheDocument();
  });
});
