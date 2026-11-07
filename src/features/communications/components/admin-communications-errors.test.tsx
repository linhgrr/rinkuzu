/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import viCommon from '@/../messages/vi/common.json';
import enCommunications from '@/../messages/en/communications.json';
import viCommunications from '@/../messages/vi/communications.json';
import viErrors from '@/../messages/vi/errors.json';
import { ApiResponseError } from '@/lib/api/client';
import type {
  CampaignDetailViewModel,
  FeedbackDetailViewModel,
  SupportDetailViewModel,
} from '../types/communication-view-model';
import { AdminCampaignDetailPage } from './AdminCampaignDetailPage';
import { AdminCampaignsPage } from './AdminCampaignsPage';
import { AdminFeedbackConversationPage } from './AdminFeedbackConversationPage';
import { AdminFeedbackPage } from './AdminFeedbackPage';
import { AdminSupportPage } from './AdminSupportPage';
import { SupportConversationPage } from './SupportConversationPage';

const mocks = vi.hoisted(() => ({
  swr: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  scheduleCampaign: vi.fn(),
  createCampaign: vi.fn(),
  createFeedbackInvitation: vi.fn(),
  createSupportTicket: vi.fn(),
  replyFeedback: vi.fn(),
  completeFeedback: vi.fn(),
}));

vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn() }),
  usePathname: () => '/admin',
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('../api/communications-api', () => ({
  cancelCampaign: vi.fn(),
  completeFeedback: mocks.completeFeedback,
  createCampaign: mocks.createCampaign,
  createFeedbackInvitation: mocks.createFeedbackInvitation,
  createSupportTicket: mocks.createSupportTicket,
  fetchCampaignDetail: vi.fn(),
  fetchCampaigns: vi.fn(),
  fetchFeedbackDetail: vi.fn(),
  fetchFeedbackList: vi.fn(),
  fetchSupportTickets: vi.fn(),
  fetchSupportDetail: vi.fn(),
  addSupportMessage: vi.fn(),
  reopenSupport: vi.fn(),
  updateSupportStatus: vi.fn(),
  uploadSupportImage: vi.fn(),
  prepareCampaign: vi.fn(),
  remindFeedback: vi.fn(),
  replyFeedback: mocks.replyFeedback,
  scheduleCampaign: mocks.scheduleCampaign,
  testCampaign: vi.fn(),
  updateCampaign: vi.fn(),
}));

const USER_ID = '6a8ed209f04328ac17443d92';
const SERVER_TEXT = 'Mongo timeout for learner secret@example.com';
const admin = viCommunications.admin;
const support = viCommunications.support;

function renderVi(ui: ReactElement) {
  return render(
    <NextIntlClientProvider
      locale="vi"
      messages={{ common: viCommon, errors: viErrors, communications: viCommunications }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function apiError(status: number, code: string): ApiResponseError {
  return new ApiResponseError({
    message: SERVER_TEXT,
    status,
    payload: { success: false, error: { code, detail: SERVER_TEXT } },
    code,
    detail: SERVER_TEXT,
  });
}

function campaignDetail(): CampaignDetailViewModel {
  return {
    campaign: {
      id: 'campaign-1',
      name: 'Tháng 11',
      subject: 'Có gì mới',
      previewText: null,
      topic: 'product_updates',
      status: 'ready',
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Xin chào' }],
      locale: null,
      planId: null,
      recipientCount: 12,
      contentHash: 'hash-2',
      testedContentHash: 'hash-1',
      testedAt: '2026-11-01T10:00:00.000Z',
      scheduledAt: null,
      sendingStartedAt: null,
      sentAt: null,
      stoppedAt: null,
      stopReason: null,
      metrics: {
        sent: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
      },
      revision: 3,
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    audience: {},
  };
}

function feedbackDetail(
  status: FeedbackDetailViewModel['conversation']['status'],
): FeedbackDetailViewModel {
  return {
    conversation: {
      id: 'feedback-1',
      userId: 'user-1',
      userEmail: 'learner@example.test',
      subject: 'Bạn thấy RinKuzu thế nào?',
      status,
      queuedAt: '2026-11-01T10:00:00.000Z',
      sentAt: status === 'queued' ? null : '2026-11-01T10:01:00.000Z',
      repliedAt: null,
      remindedAt: null,
      completedAt: null,
      declinedAt: null,
      expiresAt: '2026-12-01T10:00:00.000Z',
      lastMessageAt: '2026-11-01T10:00:00.000Z',
      revision: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    messages: [],
  };
}

function supportDetail(): SupportDetailViewModel {
  return {
    ticket: {
      id: 'ticket-1',
      userId: 'user-1',
      userEmail: 'learner@example.test',
      subject: 'Không đổi được email',
      category: 'account',
      status: 'open',
      priority: 'normal',
      createdBy: 'user',
      lastMessageAt: '2026-11-01T10:00:00.000Z',
      resolvedAt: null,
      closedAt: null,
      reopenUntil: null,
      canReopen: false,
      revision: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    messages: [],
  };
}

/** The shared ErrorState surface box, not a bare text-error line (RIN-846). */
function expectErrorBox(alert: HTMLElement): void {
  expect(alert).toHaveClass('bg-error-surface');
}

const emptyPage = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };

describe('admin communications pages use the API error layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('explains a send refused with campaign_test_required, with the code and no server text', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({ data: campaignDetail(), error: null, mutate: mocks.mutate });
    mocks.scheduleCampaign.mockRejectedValue(apiError(409, 'campaign_test_required'));

    renderVi(<AdminCampaignDetailPage id="campaign-1" />);
    await user.type(screen.getByLabelText('Thời gian gửi'), '2026-12-01T09:00');
    await user.type(screen.getByLabelText('Nhập GỬI 12'), 'GỬI 12');
    await user.click(screen.getByRole('button', { name: 'Lên lịch gửi' }));

    const alert = await screen.findByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(
      `${viErrors.api.codes.campaignTestRequired} · Mã: campaign_test_required`,
    );
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('keeps an h1 and a Back link when the campaign cannot load, with no code or server text', () => {
    mocks.swr.mockReturnValue({
      data: undefined,
      error: apiError(500, 'internal_error'),
      mutate: mocks.mutate,
    });

    renderVi(<AdminCampaignDetailPage id="campaign-1" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(admin.campaignTitle);
    expect(screen.getByRole('link', { name: admin.backToCampaigns })).toHaveAttribute(
      'href',
      '/admin/campaigns',
    );
    const alert = screen.getByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(admin.campaignLoadError);
    expect(alert).not.toHaveTextContent('Mã:');
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
  });

  it('keeps a feedback reply failure localized with its code', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({ data: feedbackDetail('sent'), error: null, mutate: mocks.mutate });
    mocks.replyFeedback.mockRejectedValue(apiError(502, 'email_provider_failed'));

    renderVi(<AdminFeedbackConversationPage id="feedback-1" />);
    await user.type(screen.getByLabelText('Trả lời qua email'), 'Cảm ơn bạn');
    await user.click(screen.getByRole('button', { name: 'Gửi email' }));

    const alert = await screen.findByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(`${admin.feedbackReplyError} · Mã: email_provider_failed`);
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
  });

  it('shows a failed completion even while the reply form is hidden', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({
      data: feedbackDetail('queued'),
      error: null,
      mutate: mocks.mutate,
    });
    mocks.completeFeedback.mockRejectedValue(apiError(409, 'revision_conflict'));

    renderVi(<AdminFeedbackConversationPage id="feedback-1" />);
    await user.click(screen.getByRole('button', { name: 'Hoàn tất' }));

    const alert = await screen.findByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent('Mã: revision_conflict');
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
  });

  it('offers Retry on a campaign load error and refetches', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({
      data: undefined,
      error: apiError(500, 'internal_error'),
      mutate: mocks.mutate,
    });

    renderVi(<AdminCampaignDetailPage id="campaign-1" />);
    await user.click(screen.getByRole('button', { name: viCommon.retry }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('offers Retry on a conversation load error and refetches', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({
      data: undefined,
      error: apiError(500, 'internal_error'),
      mutate: mocks.mutate,
    });

    renderVi(<AdminFeedbackConversationPage id="feedback-1" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(admin.feedbackTitle);
    expect(screen.getByRole('link', { name: admin.backToFeedback })).toHaveAttribute(
      'href',
      '/admin/feedback',
    );
    const alert = screen.getByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(admin.feedbackLoadError);
    expect(alert).not.toHaveTextContent('Mã:');
    await user.click(screen.getByRole('button', { name: viCommon.retry }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('shows a conversation action error under the header, above the messages', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({ data: feedbackDetail('sent'), error: null, mutate: mocks.mutate });
    mocks.completeFeedback.mockRejectedValue(apiError(409, 'revision_conflict'));

    renderVi(<AdminFeedbackConversationPage id="feedback-1" />);
    await user.click(screen.getByRole('button', { name: 'Hoàn tất' }));

    const alert = await screen.findByRole('alert');
    const list = screen.getByRole('list');
    expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    { page: 'campaigns', ui: <AdminCampaignsPage />, copy: admin.campaignsLoadError },
    { page: 'feedback', ui: <AdminFeedbackPage />, copy: admin.feedbackListLoadError },
    { page: 'support', ui: <AdminSupportPage />, copy: admin.supportListLoadError },
  ])('$page: a failed list load shows ErrorState with Retry, not a blank card', async (row) => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({
      data: undefined,
      error: apiError(500, 'internal_error'),
      mutate: mocks.mutate,
    });

    renderVi(row.ui);

    const alert = screen.getByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(row.copy);
    expect(alert).not.toHaveTextContent('Mã:');
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
    await user.click(within(alert).getByRole('button', { name: viCommon.retry }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('support detail: a failed load keeps an h1, a Back link and Retry', async () => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({
      data: undefined,
      error: apiError(500, 'internal_error'),
      isLoading: false,
      mutate: mocks.mutate,
    });

    renderVi(<SupportConversationPage ticketId="ticket-1" admin />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(support.conversationTitle);
    expect(screen.getByRole('link', { name: support.backToRequests })).toHaveAttribute(
      'href',
      '/admin/support',
    );
    const alert = screen.getByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(support.conversationError);
    expect(alert).not.toHaveTextContent('Mã:');
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
    await user.click(within(alert).getByRole('button', { name: viCommon.retry }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('support detail: a ticket with no messages says so, with no error', () => {
    mocks.swr.mockReturnValue({
      data: supportDetail(),
      error: undefined,
      isLoading: false,
      mutate: mocks.mutate,
    });

    renderVi(<SupportConversationPage ticketId="ticket-1" admin />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Không đổi được email');
    expect(screen.getByText(support.noMessages)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: support.backToRequests })).toHaveAttribute(
      'href',
      '/admin/support',
    );
  });

  it('has the invalid schedule time copy in both locales', () => {
    expect(admin.scheduleTimeInvalid).toBe('Hãy chọn thời gian gửi hợp lệ');
    expect(enCommunications.admin.scheduleTimeInvalid).toBeTruthy();
  });

  it.each([
    {
      page: 'campaigns',
      ui: <AdminCampaignsPage />,
      reject: mocks.createCampaign,
      fill: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(screen.getByLabelText('Tên nội bộ'), 'Tháng 11');
        await user.type(screen.getByLabelText('Email subject'), 'Có gì mới');
        await user.type(screen.getByLabelText('Đoạn nội dung đầu tiên'), 'Xin chào');
      },
      submit: 'Tạo bản nháp',
      fallback: admin.campaignCreateError,
    },
    {
      page: 'feedback',
      ui: <AdminFeedbackPage />,
      reject: mocks.createFeedbackInvitation,
      fill: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(screen.getByLabelText('User ID'), USER_ID);
      },
      submit: 'Gửi lời mời',
      fallback: admin.feedbackInviteError,
    },
    {
      page: 'support',
      ui: <AdminSupportPage />,
      reject: mocks.createSupportTicket,
      fill: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(screen.getByLabelText('User ID'), USER_ID);
        await user.type(screen.getByLabelText('Nội dung'), 'Xin chào');
      },
      submit: 'Tạo và gửi thông báo',
      fallback: admin.supportCreateError,
    },
  ])('$page: a failed create shows the localized fallback, not the error text', async (row) => {
    const user = userEvent.setup();
    mocks.swr.mockReturnValue({ data: emptyPage, error: null, mutate: mocks.mutate });
    row.reject.mockRejectedValue(new Error(SERVER_TEXT));

    renderVi(row.ui);
    await row.fill(user);
    await user.click(screen.getByRole('button', { name: row.submit }));

    const alert = await screen.findByRole('alert');
    expectErrorBox(alert);
    expect(alert).toHaveTextContent(row.fallback);
    expect(alert).not.toHaveTextContent(SERVER_TEXT);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
