import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enDraft from '../../../../../../../messages/en/draft.json';
import viDraft from '../../../../../../../messages/vi/draft.json';
import DraftNotFound from './not-found';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderIn(locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ draft: locale === 'vi' ? viDraft : enDraft }}
    >
      <DraftNotFound />
    </NextIntlClientProvider>,
  );
}

// RIN-993: /vi/draft/<unknown>/edit showed hardcoded English.
describe('draft not-found page', () => {
  it('renders Vietnamese copy and keeps the dashboard link on /vi', () => {
    renderIn('vi');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Không tìm thấy bản nháp' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Draft not found/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay về bảng điều khiển' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('renders English copy on /en', () => {
    renderIn('en');
    expect(screen.getByRole('heading', { level: 1, name: 'Draft not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
