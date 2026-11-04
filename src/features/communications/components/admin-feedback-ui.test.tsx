/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackDetailViewModel } from '../types/communication-view-model';
import { AdminFeedbackConversationPage } from './AdminFeedbackConversationPage';

const mocks = vi.hoisted(() => ({ swr: vi.fn(), mutate: vi.fn() }));

const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useLocale: () => 'vi', useTranslations: () => translate }));
vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('../api/communications-api', () => ({
  completeFeedback: vi.fn(),
  fetchFeedbackDetail: vi.fn(),
  remindFeedback: vi.fn(),
  replyFeedback: vi.fn(),
}));

const CONVERSATION_ID = '6a8ed209f04328ac17443d91';

function detail(
  status: FeedbackDetailViewModel['conversation']['status'],
  overrides: Partial<FeedbackDetailViewModel['conversation']> = {},
): FeedbackDetailViewModel {
  return {
    conversation: {
      id: CONVERSATION_ID,
      userId: '6a8ed209f04328ac17443d92',
      userEmail: 'user@example.com',
      subject: 'Bạn thấy trải nghiệm RinKuzu thế nào?',
      status,
      queuedAt: '2026-08-26T10:00:00.000Z',
      sentAt: null,
      repliedAt: null,
      remindedAt: null,
      completedAt: null,
      declinedAt: null,
      expiresAt: '2026-09-25T10:00:00.000Z',
      lastMessageAt: '2026-08-26T10:00:00.000Z',
      revision: 0,
      createdAt: '2026-08-26T10:00:00.000Z',
      updatedAt: '2026-08-26T10:00:00.000Z',
      ...overrides,
    },
    messages: [],
  };
}

describe('admin feedback conversation status honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a queued invitation as not yet sent and withholds outreach actions', () => {
    mocks.swr.mockReturnValue({ data: detail('queued'), error: null, mutate: mocks.mutate });

    render(<AdminFeedbackConversationPage id={CONVERSATION_ID} />);

    expect(screen.getByText(/Đang chờ gửi/u)).toBeInTheDocument();
    expect(screen.queryByText(/^Đã gửi$/u)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('chưa được gửi đi');
    expect(screen.queryByRole('button', { name: 'Nhắc lại' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi email' })).not.toBeInTheDocument();
    // Abandoning a queued invitation must stay possible: it is the only way to
    // stop one that keeps failing to send.
    expect(screen.getByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
  });

  it('enables outreach once the provider accepted the invitation', () => {
    mocks.swr.mockReturnValue({
      data: detail('sent', { sentAt: '2026-08-26T10:01:00.000Z' }),
      error: null,
      mutate: mocks.mutate,
    });

    render(<AdminFeedbackConversationPage id={CONVERSATION_ID} />);

    expect(screen.getByText(/Đã gửi/u)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhắc lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi email' })).toBeInTheDocument();
  });

  it('hides outreach entirely for a closed conversation', () => {
    mocks.swr.mockReturnValue({ data: detail('opted_out'), error: null, mutate: mocks.mutate });

    render(<AdminFeedbackConversationPage id={CONVERSATION_ID} />);

    expect(screen.getByText(/User đã opt-out/u)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhắc lại' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
  });
});
