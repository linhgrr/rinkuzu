import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import BlogPostPage, { generateMetadata } from './[slug]/page';

// RIN-504 AC3/AC5: each post links back to the FAQ and the upload CTA on its locale,
// and og:url matches the locale-prefixed canonical instead of a redirecting bare path.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/blog/ShareButtons', () => ({ ShareButtons: () => null }));
vi.mock('@/components/blog/TableOfContents', () => ({ TableOfContents: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }));

// The two posts migrated to content/blog in RIN-404 keep their URLs.
const posts = [
  { slug: 'ai-powered-quiz-generation-guide' },
  { slug: 'knowledge-graphs-adaptive-learning-pdfs' },
];

describe.each(locales)('blog posts on /%s', (locale) => {
  it.each(posts)('$slug links back to the faq and the upload CTA', async ({ slug }) => {
    const params = Promise.resolve({ locale, slug });
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        {await BlogPostPage({ params })}
      </NextIntlClientProvider>,
    );
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual(
      expect.arrayContaining([`/${locale}/faq`, `/${locale}/register?next=/adaptive/upload`]),
    );
  });

  it.each(posts)('$slug sets a locale-prefixed og:url equal to the canonical', async (post) => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale, slug: post.slug }),
    });
    const ogUrl = String(metadata.openGraph?.url);

    expect(ogUrl.endsWith(`/${locale}/blog/${post.slug}`)).toBe(true);
    expect(ogUrl).toBe(String(metadata.alternates?.canonical));
  });
});
