/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enCommon from '@/../messages/en/common.json';
import enCommunications from '@/../messages/en/communications.json';
import enErrors from '@/../messages/en/errors.json';
import viCommon from '@/../messages/vi/common.json';
import viCommunications from '@/../messages/vi/communications.json';
import viErrors from '@/../messages/vi/errors.json';
import { AdminCampaignsPage } from './AdminCampaignsPage';
import { AdminFeedbackPage } from './AdminFeedbackPage';
import { AdminSupportPage } from './AdminSupportPage';

const mocks = vi.hoisted(() => ({ swr: vi.fn() }));

vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('../api/communications-api', () => ({
  createCampaign: vi.fn(),
  createFeedbackInvitation: vi.fn(),
  createSupportTicket: vi.fn(),
  fetchCampaigns: vi.fn(),
  fetchFeedbackList: vi.fn(),
  fetchSupportTickets: vi.fn(),
}));

const MESSAGES = {
  en: { common: enCommon, errors: enErrors, communications: enCommunications },
  vi: { common: viCommon, errors: viErrors, communications: viCommunications },
};

/** English copy has no accented letters; the language picker options are removed first. */
const VIETNAMESE_LETTERS = /(?![\u0000-\u007f])\p{L}/u;

const PAGES: Array<{ name: string; ui: () => ReactElement }> = [
  { name: 'campaigns', ui: () => <AdminCampaignsPage /> },
  { name: 'feedback', ui: () => <AdminFeedbackPage /> },
  { name: 'support', ui: () => <AdminSupportPage /> },
];

function renderAt(locale: 'en' | 'vi', ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Visible copy and form values, minus the language picker whose options name each language in itself. */
function pageCopy(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('option[value="vi"], option[value="en"]').forEach((node) => node.remove());
  const values = [...clone.querySelectorAll('input, textarea')].map(
    (node) => (node as HTMLInputElement).value,
  );
  return [clone.textContent ?? '', ...values].join('\n');
}

describe('admin communications pages follow the page locale (RIN-1160)', () => {
  beforeEach(() => {
    mocks.swr.mockImplementation((key: string) => ({
      data: {
        items: [
          {
            id: 'c1',
            name: 'November news',
            // Support tickets and campaigns/feedback use different status sets.
            status: key.startsWith('/api/admin/support') ? 'waiting_for_admin' : 'draft',
            recipientCount: 2,
            subject: 'Hello',
            userEmail: 'learner@example.com',
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      },
      mutate: vi.fn(),
    }));
  });

  it.each(PAGES)('$name shows no Vietnamese at en', ({ ui }) => {
    const { container } = renderAt('en', ui());
    expect(pageCopy(container)).not.toMatch(VIETNAMESE_LETTERS);
  });

  it('campaigns renders the en strings at en', () => {
    renderAt('en', <AdminCampaignsPage />);
    expect(screen.getByRole('heading', { name: 'Email campaigns' })).toBeInTheDocument();
    expect(screen.getByLabelText('Internal name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeInTheDocument();
    expect(screen.getByText(/Draft · 2 recipients/u)).toBeInTheDocument();
  });

  it('campaigns renders the vi strings at vi', () => {
    renderAt('vi', <AdminCampaignsPage />);
    expect(screen.getByRole('heading', { name: 'Chiến dịch email' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tiêu đề email')).toBeInTheDocument();
    expect(screen.getByLabelText('Chủ đề')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo bản nháp' })).toBeInTheDocument();
    expect(screen.getByText(/Bản nháp · 2 người nhận/u)).toBeInTheDocument();
    expect(screen.queryByText(/Email Campaigns|Topic|recipients/u)).toBeNull();
  });

  it('support and feedback render their vi actions at vi', () => {
    const { unmount } = renderAt('vi', <AdminSupportPage />);
    expect(screen.getByRole('button', { name: 'Tạo và gửi thông báo' })).toBeInTheDocument();
    expect(screen.getByText(/Chờ hỗ trợ viên/u)).toBeInTheDocument();
    expect(screen.queryByText('Support Center')).toBeNull();
    unmount();
    renderAt('vi', <AdminFeedbackPage />);
    expect(screen.getByRole('button', { name: 'Gửi lời mời' })).toBeInTheDocument();
  });
});
