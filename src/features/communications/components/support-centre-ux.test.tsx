/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enCommunications from '../../../../messages/en/communications.json';
import viCommunications from '../../../../messages/vi/communications.json';
import { SupportCenterPage } from './SupportCenterPage';
import { SupportConversationPage } from './SupportConversationPage';

/**
 * RIN-1018: the support centre uses the app's own controls and copy, not the browser's.
 * The translator reads the real message files so a key missing in vi or en fails here.
 */
const mocks = vi.hoisted(() => ({
  addSupportMessage: vi.fn(),
  createSupportTicket: vi.fn(),
  reopenSupport: vi.fn(),
  uploadSupportImage: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  swr: vi.fn(),
  locale: 'vi' as 'vi' | 'en',
}));

type Messages = Record<string, unknown>;

function lookup(messages: Messages, path: string): string | undefined {
  let node: unknown = messages;
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Messages)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

vi.mock('next-intl', () => ({
  useLocale: () => mocks.locale,
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, string | number>): string => {
      const files = { communications: mocks.locale === 'vi' ? viCommunications : enCommunications };
      const [root, ...rest] = `${namespace}.${key}`.split('.');
      const file = root === 'communications' ? files.communications : undefined;
      const template = file ? lookup(file, rest.join('.')) : undefined;
      if (!template) return `${namespace}.${key}`;
      return template.replace(/\{(\w+)\}/gu, (_, name: string) => String(values?.[name] ?? ''));
    },
}));
vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('../api/communications-api', () => ({
  addSupportMessage: (...args: unknown[]) => mocks.addSupportMessage(...args),
  createSupportTicket: (...args: unknown[]) => mocks.createSupportTicket(...args),
  fetchSupportDetail: vi.fn(),
  fetchSupportTickets: vi.fn(),
  reopenSupport: (...args: unknown[]) => mocks.reopenSupport(...args),
  updateSupportStatus: vi.fn(),
  uploadSupportImage: (...args: unknown[]) => mocks.uploadSupportImage(...args),
}));

const TICKET_ID = '507f191e810c19729de860ea';

function listResponse(items: unknown[] = []) {
  return {
    data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } },
    error: null,
    isLoading: false,
    mutate: mocks.mutate,
  };
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    userId: 'u1',
    subject: 'Không đổi được email',
    category: 'account',
    status: 'waiting_for_user',
    priority: 'normal',
    createdBy: 'user',
    lastMessageAt: '2026-11-06T08:00:00.000Z',
    resolvedAt: null,
    closedAt: null,
    reopenUntil: null,
    canReopen: false,
    revision: 3,
    createdAt: '2026-11-06T07:00:00.000Z',
    updatedAt: '2026-11-06T08:00:00.000Z',
    ...overrides,
  };
}

function detailResponse(ticketOverrides: Record<string, unknown> = {}) {
  return {
    data: {
      ticket: ticket(ticketOverrides),
      messages: [
        {
          id: 'm1',
          authorUserId: 'u1',
          authorRole: 'user',
          body: 'Mình không đổi được email.',
          attachments: [],
          createdAt: '2026-11-06T07:00:00.000Z',
        },
        {
          id: 'm2',
          authorUserId: 'a1',
          authorRole: 'admin',
          body: 'Bạn thử đăng xuất rồi đăng nhập lại nhé.',
          attachments: [],
          createdAt: '2026-11-06T08:00:00.000Z',
        },
      ],
    },
    error: null,
    isLoading: false,
    mutate: mocks.mutate,
  };
}

function png(name: string, size = 1024): File {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('support centre (RIN-1018)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale = 'vi';
    mocks.mutate.mockResolvedValue(undefined);
    mocks.createSupportTicket.mockResolvedValue({ ticket: { id: TICKET_ID } });
    mocks.addSupportMessage.mockResolvedValue({});
    mocks.uploadSupportImage.mockResolvedValue('att-1');
  });

  describe('new request page', () => {
    it('has one page h1 and a form that opts out of native validation', () => {
      mocks.swr.mockReturnValue(listResponse());
      const { container } = render(<SupportCenterPage />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent('Hỗ trợ');
      expect(screen.getByRole('heading', { level: 2, name: 'Liên hệ hỗ trợ' })).toBeVisible();
      expect(screen.getByRole('heading', { level: 2, name: 'Yêu cầu của bạn' })).toBeVisible();
      expect(container.querySelector('form')).toHaveAttribute('novalidate');
    });

    it('shows inline localized errors under subject and message instead of submitting', async () => {
      mocks.swr.mockReturnValue(listResponse());
      const user = userEvent.setup();
      render(<SupportCenterPage />);

      await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'ab');
      await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

      const subject = screen.getByRole('textbox', { name: 'Tiêu đề' });
      const body = screen.getByRole('textbox', { name: 'Nội dung' });
      expect(subject).toHaveAttribute('aria-invalid', 'true');
      expect(subject).toHaveAccessibleDescription(viCommunications.support.errors.subjectTooShort);
      expect(body).toHaveAttribute('aria-invalid', 'true');
      expect(body).toHaveAccessibleDescription(viCommunications.support.errors.bodyRequired);
      expect(mocks.createSupportTicket).not.toHaveBeenCalled();
      expect(subject).toHaveFocus();
    });

    it('picks screenshots with a localized button, lists them and removes one', async () => {
      mocks.swr.mockReturnValue(listResponse());
      const user = userEvent.setup();
      render(<SupportCenterPage />);

      expect(screen.queryByText(/Choose Files|No file chosen/u)).not.toBeInTheDocument();
      const input = screen.getByLabelText(viCommunications.support.addImages, {
        selector: 'input[type="file"]',
      });
      await user.upload(input, [png('a.png'), png('b.png')]);

      const list = screen.getByRole('list', { name: viCommunications.support.attachments });
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
      await user.click(screen.getByRole('button', { name: 'Xóa ảnh a.png' }));
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(await within(list).findByRole('img', { name: 'b.png' })).toBeVisible();

      await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Cần hỗ trợ');
      await user.type(screen.getByRole('textbox', { name: 'Nội dung' }), 'Nội dung');
      await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

      await waitFor(() =>
        expect(mocks.createSupportTicket).toHaveBeenCalledWith(
          expect.objectContaining({ attachmentIds: ['att-1'] }),
        ),
      );
      expect(mocks.uploadSupportImage).toHaveBeenCalledTimes(1);
    });

    it('caps screenshots at three and rejects oversized files with an inline note', async () => {
      mocks.swr.mockReturnValue(listResponse());
      const user = userEvent.setup();
      render(<SupportCenterPage />);

      const input = screen.getByLabelText(viCommunications.support.addImages, {
        selector: 'input[type="file"]',
      });
      await user.upload(input, [png('big.png', 6 * 1024 * 1024), png('1.png'), png('2.png')]);
      await user.upload(input, [png('3.png'), png('4.png')]);

      const list = screen.getByRole('list', { name: viCommunications.support.attachments });
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByText(viCommunications.support.errors.attachmentRejected)).toBeVisible();
      expect(
        screen.getByRole('button', { name: viCommunications.support.addImages }),
      ).toBeDisabled();
    });

    it('shows a send failure in an alert with an icon', async () => {
      mocks.swr.mockReturnValue(listResponse());
      mocks.createSupportTicket.mockRejectedValue(new Error('boom'));
      const user = userEvent.setup();
      render(<SupportCenterPage />);

      await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Cần hỗ trợ');
      await user.type(screen.getByRole('textbox', { name: 'Nội dung' }), 'Nội dung');
      await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

      const alert = await screen.findByRole('alert');
      expect(alert.querySelector('svg')).not.toBeNull();
    });

    it('lists requests as links with a status badge', () => {
      mocks.swr.mockReturnValue(listResponse([ticket({ status: 'resolved' })]));
      render(<SupportCenterPage />);

      const link = screen.getByRole('link', { name: /Không đổi được email/u });
      expect(link).toHaveAttribute('href', `/support/${TICKET_ID}`);
      expect(within(link).getByText('Đã xử lý')).toHaveAttribute('data-status', 'resolved');
    });
  });

  describe('thread page', () => {
    it('has the subject as h1, a back link and an author line on each message', () => {
      mocks.swr.mockReturnValue(detailResponse());
      render(<SupportConversationPage ticketId={TICKET_ID} />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent('Không đổi được email');
      expect(screen.getByRole('link', { name: /Quay lại danh sách yêu cầu/u })).toHaveAttribute(
        'href',
        '/support',
      );
      const items = within(screen.getByRole('list', { name: 'Lịch sử trao đổi' })).getAllByRole(
        'listitem',
      );
      expect(items[0]).toHaveTextContent(viCommunications.support.authorYou);
      expect(items[1]).toHaveTextContent(viCommunications.support.authorSupport);
      expect(screen.getByText('Chờ bạn phản hồi')).toHaveAttribute(
        'data-status',
        'waiting_for_user',
      );
    });

    it('validates an empty reply inline without calling the API', async () => {
      mocks.swr.mockReturnValue(detailResponse());
      const user = userEvent.setup();
      const { container } = render(<SupportConversationPage ticketId={TICKET_ID} />);

      expect(container.querySelector('form')).toHaveAttribute('novalidate');
      await user.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));

      expect(screen.getByRole('textbox', { name: 'Phản hồi' })).toHaveAccessibleDescription(
        viCommunications.support.errors.replyRequired,
      );
      expect(mocks.addSupportMessage).not.toHaveBeenCalled();
    });

    it('tells the learner that replying reopens a resolved request', () => {
      mocks.swr.mockReturnValue(detailResponse({ status: 'resolved' }));
      render(<SupportConversationPage ticketId={TICKET_ID} />);

      expect(screen.getByText(viCommunications.support.resolvedNote)).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Phản hồi' })).toBeVisible();
    });

    it('offers reopen on a closed request within the window', async () => {
      mocks.swr.mockReturnValue(
        detailResponse({
          status: 'closed',
          canReopen: true,
          reopenUntil: '2099-01-01T00:00:00.000Z',
        }),
      );
      mocks.reopenSupport.mockResolvedValue({});
      const user = userEvent.setup();
      render(<SupportConversationPage ticketId={TICKET_ID} />);

      expect(screen.getByText(viCommunications.support.closedReopenNote)).toBeVisible();
      expect(screen.queryByRole('textbox', { name: 'Phản hồi' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Mở lại' }));
      expect(mocks.reopenSupport).toHaveBeenCalledWith(TICKET_ID);
    });

    it('points to a new request once a closed request can no longer be reopened', () => {
      mocks.swr.mockReturnValue(
        detailResponse({
          status: 'closed',
          canReopen: false,
          reopenUntil: '2020-01-01T00:00:00.000Z',
        }),
      );
      render(<SupportConversationPage ticketId={TICKET_ID} />);

      expect(screen.getByText(viCommunications.support.closedFinalNote)).toBeVisible();
      expect(
        screen.getByRole('link', { name: viCommunications.support.newRequest }),
      ).toHaveAttribute('href', '/support');
      expect(screen.queryByRole('button', { name: 'Mở lại' })).not.toBeInTheDocument();
    });

    it('renders English copy when the locale is en', () => {
      mocks.locale = 'en';
      mocks.swr.mockReturnValue(detailResponse());
      render(<SupportConversationPage ticketId={TICKET_ID} />);

      expect(screen.getByRole('link', { name: /Back to requests/u })).toBeVisible();
      expect(screen.getByText('You')).toBeVisible();
      expect(screen.getByText('Rinkuzu Support')).toBeVisible();
    });
  });
});
