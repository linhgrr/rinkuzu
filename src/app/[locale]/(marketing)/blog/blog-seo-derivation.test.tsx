import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/lib/blog/content';
import { buildPublicSitemapEntries } from '@/lib/public-sitemap';
import { canonicalFor } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import BlogPostPage, { generateMetadata } from './[slug]/page';

// RIN-406: a post's sitemap entries, metadata and JSON-LD come from its frontmatter in
// content/blog, so publishing a post needs no hand-written SEO fields anywhere else.

const SAMPLE: BlogPost = {
  slug: 'sample-post-from-frontmatter',
  title: 'Sample Post From Frontmatter',
  description: 'Card description of the sample post.',
  seoDescription: 'SEO description of the sample post.',
  date: '2026-10-05',
  category: 'Learning Science',
  readTimeMinutes: 6,
  heroImage: 'https://images.unsplash.com/photo-sample?w=1200&q=80',
  heroImageAlt: 'Sample hero image',
  locale: 'en',
  author: 'rinkuzu-team',
  wordCount: 1234,
  timeRequiredMinutes: 8,
  content: '## First section\n\nBody text.\n',
};

vi.mock('@/lib/blog/content', () => ({
  getAllBlogPosts: () => [SAMPLE],
  getBlogPostsByLocale: (locale: string) => (locale === SAMPLE.locale ? [SAMPLE] : []),
  getBlogPostBySlug: (locale: string, slug: string) =>
    locale === SAMPLE.locale && slug === SAMPLE.slug ? SAMPLE : undefined,
}));
vi.mock('@/lib/public-quiz-sitemap', () => ({ loadPublicQuizSitemapEntries: async () => [] }));
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

const params = (locale: string) => Promise.resolve({ locale, slug: SAMPLE.slug });

describe('blog SEO derived from content frontmatter', () => {
  it('lists the post and its author in the sitemap, dated by frontmatter, in every locale', async () => {
    const entries = await buildPublicSitemapEntries('test');
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    for (const locale of ['en', 'vi']) {
      const post = byUrl.get(canonicalFor(locale, `/blog/${SAMPLE.slug}`));
      expect(post?.lastModified).toEqual(new Date(`${SAMPLE.date}T00:00:00.000Z`));
      expect(post?.alternates?.languages).toMatchObject({
        en: canonicalFor('en', `/blog/${SAMPLE.slug}`),
        vi: canonicalFor('vi', `/blog/${SAMPLE.slug}`),
      });
      expect(byUrl.get(canonicalFor(locale, `/blog/authors/${SAMPLE.author}`))).toBeTruthy();
    }
  });

  it('keeps no hand-written post or author routes in the static route list', () => {
    const blogRoutes = INDEXABLE_STATIC_PUBLIC_ROUTES.filter((route) => route.startsWith('/blog'));
    expect(blogRoutes).toEqual(['/blog', '/blog/authors']);
  });

  it('builds the article metadata from frontmatter', async () => {
    const metadata = await generateMetadata({ params: params('en') });

    expect(metadata.title).toBe(`${SAMPLE.title} | RinKuzu`);
    expect(metadata.description).toBe(SAMPLE.seoDescription);
    expect(metadata.alternates?.canonical).toBe(canonicalFor('en', `/blog/${SAMPLE.slug}`));
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: `${SAMPLE.date}T00:00:00.000Z`,
      images: [expect.objectContaining({ url: SAMPLE.heroImage, alt: SAMPLE.heroImageAlt })],
    });
  });

  it('renders Article JSON-LD from frontmatter', async () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{}}>
        {await BlogPostPage({ params: params('en') })}
      </NextIntlClientProvider>,
    );
    const schemas = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (node) => JSON.parse(node.textContent ?? '{}') as Record<string, unknown>,
    );
    const article = schemas.find((schema) => schema['@type'] === 'Article');

    expect(article).toMatchObject({
      headline: SAMPLE.title,
      description: SAMPLE.seoDescription,
      datePublished: SAMPLE.date,
      wordCount: SAMPLE.wordCount,
      timeRequired: `PT${SAMPLE.timeRequiredMinutes}M`,
      image: expect.objectContaining({ url: SAMPLE.heroImage }),
    });
  });
});
