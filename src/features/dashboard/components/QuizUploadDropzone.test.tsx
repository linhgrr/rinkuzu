/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../messages/en/create.json';
import enDashboard from '../../../../messages/en/dashboard.json';
import viCreate from '../../../../messages/vi/create.json';
import viDashboard from '../../../../messages/vi/dashboard.json';
import { QuizUploadDropzone } from './QuizUploadDropzone';

vi.mock('next/image', () => ({
  // The test double keeps the img contract without the Next optimizer.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/usePdfUploadPolicy', () => ({
  usePdfUploadPolicy: () => ({ maxPages: 30, maxBytes: 10 * 1024 * 1024, isLoading: false }),
}));

const messages = {
  en: { create: enCreate, dashboard: enDashboard },
  vi: { create: viCreate, dashboard: viDashboard },
} as const;

function renderDropzone(locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <QuizUploadDropzone />
    </NextIntlClientProvider>,
  );
}

// RIN-1339 (spec RIN-1336 Part 1, AC 3): the dashboard and profile upload area
// says, in one line under it, that created quizzes are public.
describe('QuizUploadDropzone public-quiz notice', () => {
  it('shows the short English notice under the upload area, outside the file label', () => {
    const { container } = renderDropzone('en');

    const link = screen.getByRole('link', { name: 'Terms' });
    expect(link).toHaveAttribute('href', '/en/terms#public-quizzes');
    const notice = link.closest('p');
    expect(notice).toHaveTextContent('Quizzes you create are shared publicly. Terms');
    const label = container.querySelector('label');
    expect(label).not.toContainElement(link);
    expect(notice?.previousElementSibling).toBe(label);
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('shows only the Vietnamese copy in Vietnamese', () => {
    const { container } = renderDropzone('vi');

    expect(screen.getByRole('link', { name: 'Điều khoản' })).toHaveAttribute(
      'href',
      '/vi/terms#public-quizzes',
    );
    expect(container).toHaveTextContent('Quiz tạo ra sẽ được chia sẻ công khai. Điều khoản');
    expect(container).not.toHaveTextContent('publicly');
  });
});
