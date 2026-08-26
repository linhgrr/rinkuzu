/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingSupportButton } from './FloatingSupportButton';
import { MarketingPreferencesPage } from './MarketingPreferencesPage';
import { SupportCenterPage } from './SupportCenterPage';

const mocks = vi.hoisted(() => ({
  createSupportTicket: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  saveMarketingPreferences: vi.fn(),
  swr: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (namespace: string) => (key: string) => {
    const messages: Record<string, string> = {
      'communications.floatingSupport.label': 'Mở trung tâm hỗ trợ',
      'communications.floatingSupport.title': 'Hỗ trợ',
      'communications.marketingPreferences.loadError': 'Không thể tải lựa chọn email.',
      'communications.marketingPreferences.loading': 'Đang tải…',
      'communications.marketingPreferences.title': 'Email bạn muốn nhận',
      'communications.marketingPreferences.description': 'Mô tả',
      'communications.marketingPreferences.productUpdates': 'Cập nhật sản phẩm',
      'communications.marketingPreferences.productUpdatesDescription': 'Mô tả cập nhật',
      'communications.marketingPreferences.promotions': 'Ưu đãi',
      'communications.marketingPreferences.promotionsDescription': 'Mô tả ưu đãi',
      'communications.marketingPreferences.saved': 'Đã lưu lựa chọn.',
      'communications.marketingPreferences.save': 'Lưu lựa chọn',
      'communications.marketingPreferences.saveError': 'Không thể lưu lựa chọn email.',
      'communications.support.title': 'Liên hệ hỗ trợ',
      'communications.support.subject': 'Tiêu đề',
      'communications.support.category': 'Loại yêu cầu',
      'communications.support.categories.general': 'Chung',
      'communications.support.categories.account': 'Tài khoản',
      'communications.support.categories.billing': 'Thanh toán',
      'communications.support.categories.technical': 'Kỹ thuật',
      'communications.support.categories.feedback': 'Góp ý',
      'communications.support.body': 'Nội dung',
      'communications.support.attachments': 'Ảnh minh họa',
      'communications.support.submit': 'Gửi yêu cầu',
      'communications.support.createError': 'Không thể tạo ticket hỗ trợ',
      'communications.support.listTitle': 'Yêu cầu của bạn',
      'communications.support.loading': 'Đang tải…',
      'communications.support.listError': 'Không thể tải danh sách hỗ trợ.',
      'communications.support.emptyTitle': 'Chưa có yêu cầu hỗ trợ',
      'communications.support.emptyDescription': 'Các cuộc trao đổi sẽ xuất hiện tại đây.',
      'communications.support.previous': 'Trang trước',
      'communications.support.next': 'Trang sau',
    };
    return messages[`${namespace}.${key}`] ?? key;
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
  createSupportTicket: (...args: unknown[]) => mocks.createSupportTicket(...args),
  fetchMarketingPreferences: vi.fn(),
  fetchSupportTickets: vi.fn(),
  saveMarketingPreferences: (...args: unknown[]) => mocks.saveMarketingPreferences(...args),
  uploadSupportImage: vi.fn(),
}));

describe('communications UI accessibility and behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutate.mockResolvedValue(undefined);
    mocks.saveMarketingPreferences.mockResolvedValue({});
    mocks.createSupportTicket.mockResolvedValue({
      ticket: { id: '507f191e810c19729de860ea' },
    });
  });

  it('exposes the floating support entry point as a named link', () => {
    render(<FloatingSupportButton />);

    expect(screen.getByRole('link', { name: 'Mở trung tâm hỗ trợ' })).toHaveAttribute(
      'href',
      '/support',
    );
  });

  it('lets a user opt into one marketing topic without changing the other', async () => {
    mocks.swr.mockReturnValue({
      data: { productUpdates: false, promotions: false, updatedAt: null },
      error: null,
      mutate: mocks.mutate,
    });
    const user = userEvent.setup();
    render(<MarketingPreferencesPage />);

    await user.click(screen.getByRole('checkbox', { name: /Cập nhật sản phẩm/u }));
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }));

    await waitFor(() =>
      expect(mocks.saveMarketingPreferences).toHaveBeenCalledWith({
        productUpdates: true,
        promotions: false,
        locale: 'vi',
        source: 'settings',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu lựa chọn.');
  });

  it('creates a support ticket from labeled controls and opens its thread', async () => {
    mocks.swr.mockReturnValue({
      data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
      error: null,
      isLoading: false,
      mutate: mocks.mutate,
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '0aa7c561-a366-4abf-81ec-fb90e64c237c',
    );
    const user = userEvent.setup();
    render(<SupportCenterPage />);

    await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Cần hỗ trợ tài khoản');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Loại yêu cầu' }), 'account');
    await user.type(
      screen.getByRole('textbox', { name: 'Nội dung' }),
      'Mình không đổi được email.',
    );
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await waitFor(() =>
      expect(mocks.createSupportTicket).toHaveBeenCalledWith({
        subject: 'Cần hỗ trợ tài khoản',
        category: 'account',
        body: 'Mình không đổi được email.',
        attachmentIds: [],
        clientMessageId: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith('/support/507f191e810c19729de860ea');
  });
});
