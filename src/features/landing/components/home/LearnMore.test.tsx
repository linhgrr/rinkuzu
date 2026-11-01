import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import LearnMore from './LearnMore';

// RIN-504 AC2: the static homepage must carry crawlable links to the FAQ, the blog,
// premium quizzes and the newest blog posts, on the route locale.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

describe.each(locales)('homepage learn-more links on /%s', (locale) => {
  function hrefs() {
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        <LearnMore locale={locale} />
      </NextIntlClientProvider>,
    );
    return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
  }

  it('links to the faq, blog, premium quizzes and the two newest posts', () => {
    expect(hrefs()).toEqual(
      expect.arrayContaining([
        `/${locale}/faq`,
        `/${locale}/blog`,
        `/${locale}/premium-quizzes`,
        `/${locale}/blog/ai-powered-quiz-generation-guide`,
        `/${locale}/blog/knowledge-graphs-adaptive-learning-pdfs`,
      ]),
    );
  });

  it('keeps every link on the route locale', () => {
    for (const href of hrefs()) {
      expect(href?.startsWith(`/${locale}/`)).toBe(true);
    }
  });
});
