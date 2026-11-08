/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enAdmin from '@/../messages/en/admin.json';
import enCommon from '@/../messages/en/common.json';
import enErrors from '@/../messages/en/errors.json';
import viAdmin from '@/../messages/vi/admin.json';
import viCommon from '@/../messages/vi/common.json';
import viErrors from '@/../messages/vi/errors.json';
import type { AdminSubscriptionViewModel } from '../types/admin-subscriptions-view-model';
import { AdminSubscriptionsPageClient } from './AdminSubscriptionsPageClient';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), revoke: vi.fn() }));

vi.mock('@/features/admin/subscriptions/api/admin-subscriptions-api', () => ({
  fetchAdminSubscriptionsViewModel: (...args: unknown[]) => mocks.fetch(...args),
  revokeAdminSubscription: (...args: unknown[]) => mocks.revoke(...args),
}));

const MESSAGES = {
  en: { admin: enAdmin, common: enCommon, errors: enErrors },
  vi: { admin: viAdmin, common: viCommon, errors: viErrors },
};

const SUBSCRIPTION: AdminSubscriptionViewModel = {
  id: 'sub-1',
  userId: 'user-1',
  userEmail: 'learner@example.com',
  plan: { id: 'plan-1', name: 'Premium' },
  amount: 99000,
  amountLabel: '99.000 ₫',
  currency: 'VND',
  status: 'completed',
  payosOrderId: '123456',
  payosTransactionIdLabel: '—',
  startDateLabel: '01/11/2026',
  endDateLabel: '01/12/2026',
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  createdAtLabel: '01/11/2026',
  updatedAt: '2026-11-01T00:00:00.000Z',
  updatedAtLabel: '01/11/2026',
};

function renderAt(locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <AdminSubscriptionsPageClient />
    </NextIntlClientProvider>,
  );
}

function listResult(subscriptions: AdminSubscriptionViewModel[]) {
  return {
    subscriptions,
    pagination: { page: 1, limit: 10, total: subscriptions.length, totalPages: 1 },
  };
}

describe('admin subscriptions page follows the page locale (RIN-1160)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no <dialog> modal API.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('renders the empty state in Vietnamese at vi', async () => {
    mocks.fetch.mockResolvedValue(listResult([]));
    renderAt('vi');

    expect(await screen.findByText(viAdmin.subscriptionsPage.emptyHint)).toBeInTheDocument();
    expect(screen.getByText(viAdmin.subscriptionsPage.description)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tất cả gói đăng ký' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đang hiệu lực' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hết hạn' })).toBeInTheDocument();
    expect(
      screen.queryByText(/All Subscriptions|No subscriptions found|Try adjusting/u),
    ).toBeNull();
  });

  it('says "no subscriptions" once, as the empty-state heading (RIN-1171)', async () => {
    mocks.fetch.mockResolvedValue(listResult([]));
    renderAt('en');

    expect(
      await screen.findByRole('heading', { name: enAdmin.noSubscriptionsFound }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(enAdmin.noSubscriptionsFound)).toHaveLength(1);
  });

  it('renders the list and revoke dialog in English at en, naming the word to type', async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(listResult([SUBSCRIPTION]));
    renderAt('en');

    await user.click(await screen.findByRole('button', { name: /View details/u }));

    expect(screen.getByText('Showing 1 to 1 of 1 subscriptions')).toBeInTheDocument();
    expect(screen.getByLabelText('Type REVOKE to confirm')).toHaveAttribute(
      'placeholder',
      'REVOKE',
    );
    expect(screen.getByRole('button', { name: 'Revoke Premium' })).toBeDisabled();
    expect(document.body.textContent ?? '').not.toMatch(/(?![\u0000-\u007f])\p{L}/u);
  });

  it('labels the vi revoke confirmation with the same word to type', async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(listResult([SUBSCRIPTION]));
    renderAt('vi');

    await user.click(await screen.findByRole('button', { name: /Xem chi tiết/u }));

    expect(screen.getByLabelText('Nhập REVOKE để xác nhận')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu hồi Premium' })).toBeDisabled();
  });
});
