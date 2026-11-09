import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

import TermsPage from './page';
import PrivacyPage from '../privacy/page';

async function renderTerms(locale: 'en' | 'vi') {
  return render(await TermsPage({ params: Promise.resolve({ locale }) }));
}

async function renderPrivacy(locale: 'en' | 'vi') {
  return render(await PrivacyPage({ params: Promise.resolve({ locale }) }));
}

describe('/[locale]/terms public quizzes section (RIN-1340)', () => {
  it('en: §6.4 "Public quizzes" sits at #public-quizzes and §6.1 points to it', async () => {
    const { container } = await renderTerms('en');

    const section = container.querySelector('#public-quizzes');
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent('6.4 Public quizzes');
    expect(section).toHaveTextContent(
      'Quizzes you create on RinKuzu are published in the public RinKuzu quiz library',
    );
    expect(container).toHaveTextContent('including publishing your quizzes as described in 6.4');
    expect(container).not.toHaveTextContent('6.3 Community Quizzes');
    expect(container).toHaveTextContent('Last updated: November 9, 2026');
  });

  it('vi: §6 carries the public-quiz text at #public-quizzes', async () => {
    const { container } = await renderTerms('vi');

    const section = container.querySelector('#public-quizzes');
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent('6. Quyền đối với nội dung');
    expect(section).toHaveTextContent(
      'Quiz bạn tạo trên RinKuzu được đăng công khai trong kho quiz RinKuzu',
    );
    expect(section).not.toHaveTextContent('Khi công khai quiz');
    expect(container).toHaveTextContent('Cập nhật lần cuối: 9 tháng 11, 2026');
  });
});

describe('/[locale]/privacy §1.2 (RIN-1340)', () => {
  it('en: says quizzes are public and the PDF file is not', async () => {
    const { container } = await renderPrivacy('en');

    expect(container).toHaveTextContent(
      'quizzes generated from your PDFs are public, as described in Terms §6.4; the PDF file itself is not published',
    );
    expect(container).not.toHaveTextContent('if you choose to share quizzes publicly');
  });

  it('vi: says quizzes are public and the PDF file is not', async () => {
    const { container } = await renderPrivacy('vi');

    expect(container).toHaveTextContent(
      'Quiz tạo từ PDF của bạn được công khai theo Điều khoản mục 6; bản thân tệp PDF không được công khai',
    );
  });
});
