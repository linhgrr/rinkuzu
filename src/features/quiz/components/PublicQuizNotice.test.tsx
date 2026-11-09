/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enCreate from '../../../../messages/en/create.json';
import viCreate from '../../../../messages/vi/create.json';
import { PublicQuizNotice } from './PublicQuizNotice';

type Locale = 'en' | 'vi';
const messages = { en: { create: enCreate }, vi: { create: viCreate } } as const;

function renderNotice(locale: Locale, props: Parameters<typeof PublicQuizNotice>[0]) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PublicQuizNotice {...props} />
    </NextIntlClientProvider>,
  );
}

// RIN-1339 (spec RIN-1336 Part 1): every create surface tells the learner,
// before the quiz goes live, that it lands in the public library.
describe('PublicQuizNotice', () => {
  it('full variant in English: public, Google, personal data, Terms link, Premium pointer', () => {
    const { container } = renderNotice('en', { variant: 'full', showPremiumPointer: true });

    expect(container).toHaveTextContent(
      "Quizzes you create are shared publicly in the Rinkuzu library and may appear on Google. Don't include other people's personal data (names, phone numbers, student or ID numbers). See the Terms.",
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/en/terms#public-quizzes',
    );
    // The pointer quotes the Premium checkbox label verbatim so the two match.
    expect(container).toHaveTextContent(
      `Want it in the Premium catalog instead of the free library? Choose ${enCreate.premiumQuiz} below.`,
    );
    expect(container).not.toHaveTextContent('công khai');
  });

  it('full variant in Vietnamese shows only Vietnamese copy and the /vi Terms link', () => {
    const { container } = renderNotice('vi', { variant: 'full', showPremiumPointer: true });

    expect(container).toHaveTextContent(
      'Quiz bạn tạo sẽ được chia sẻ công khai trong kho quiz Rinkuzu và có thể xuất hiện trên Google. Đừng đưa vào thông tin cá nhân của người khác (tên, số điện thoại, mã số sinh viên, CCCD). Xem Điều khoản.',
    );
    expect(screen.getByRole('link', { name: 'Điều khoản' })).toHaveAttribute(
      'href',
      '/vi/terms#public-quizzes',
    );
    expect(container).toHaveTextContent(
      `Muốn đưa quiz vào kho Premium thay vì kho miễn phí? Chọn ${viCreate.premiumQuiz} bên dưới.`,
    );
    expect(container).not.toHaveTextContent('publicly');
  });

  it('omits the Premium pointer where there is no Premium choice', () => {
    const { container } = renderNotice('en', { variant: 'full' });

    expect(container).toHaveTextContent('Quizzes you create are shared publicly');
    expect(container).not.toHaveTextContent('Premium');
  });

  it('short variant is one line with the Terms link, in each locale', () => {
    const en = renderNotice('en', { variant: 'short' });
    expect(en.container).toHaveTextContent('Quizzes you create are shared publicly. Terms');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/en/terms#public-quizzes',
    );
    expect(en.container.querySelectorAll('p')).toHaveLength(1);
    en.unmount();

    const vi = renderNotice('vi', { variant: 'short' });
    expect(vi.container).toHaveTextContent('Quiz tạo ra sẽ được chia sẻ công khai. Điều khoản');
    expect(screen.getByRole('link', { name: 'Điều khoản' })).toHaveAttribute(
      'href',
      '/vi/terms#public-quizzes',
    );
  });

  it('is plain help text: no inputs, no alert or dialog role', () => {
    const { container } = renderNotice('en', { variant: 'full', showPremiumPointer: true });

    expect(container.querySelector('input, select, textarea, button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
