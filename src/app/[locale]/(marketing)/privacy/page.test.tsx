import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import PrivacyPage from './page';

async function renderPrivacy(locale: 'en' | 'vi') {
  return render(await PrivacyPage({ params: Promise.resolve({ locale }) }));
}

describe('/[locale]/privacy first-touch source note (RIN-1761)', () => {
  it('en: says what is kept, for how long and where it is saved', async () => {
    const { container } = await renderPrivacy('en');

    expect(container).toHaveTextContent(
      'campaign tags and the type of referring site, not the full URL) for 7 days in your browser, and save it with your account if you sign up',
    );
  });

  it('vi: says the same in Vietnamese', async () => {
    const { container } = await renderPrivacy('vi');

    expect(container).toHaveTextContent(
      'thẻ chiến dịch và loại trang giới thiệu, không phải đường dẫn đầy đủ) trong 7 ngày trên trình duyệt của bạn, và lưu cùng tài khoản nếu bạn đăng ký',
    );
  });
});
