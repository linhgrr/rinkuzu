import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import FAQPage from './page';

// RIN-504 AC3: the FAQ links into the blog guide and premium quizzes on its own locale.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/faq',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

describe.each(locales)('faq cross-links on /%s', (locale) => {
  it('links to the blog guide and premium quizzes', async () => {
    const page = await FAQPage({ params: Promise.resolve({ locale }) });
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        {page}
      </NextIntlClientProvider>,
    );
    const hrefs = Array.from(container.querySelectorAll('a[href^="/"]')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(
      expect.arrayContaining([
        `/${locale}/blog/ai-powered-quiz-generation-guide`,
        `/${locale}/premium-quizzes`,
      ]),
    );
    for (const href of hrefs) {
      expect(href === `/${locale}` || href?.startsWith(`/${locale}/`)).toBe(true);
    }
  });
});
