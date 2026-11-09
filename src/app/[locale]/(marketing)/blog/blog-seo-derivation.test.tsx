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

// RIN-1312: a Vietnamese article with no English file, and a Vietnamese listing-only
// translation (no body) of an English article. Fake content.
const VI_ONLY: BlogPost = {
  ...SAMPLE,
  slug: 'bai-viet-chi-tieng-viet',
  title: 'Bài viết chỉ có tiếng Việt',
  locale: 'vi',
  content: '## Phần một\n\nNội dung.\n',
};
const VI_LISTING_ONLY: BlogPost = { ...SAMPLE, locale: 'vi', content: '' };

const { POSTS } = vi.hoisted(() => ({ POSTS: [] as BlogPost[] }));
POSTS.push(SAMPLE, VI_ONLY, VI_LISTING_ONLY);

vi.mock('@/lib/blog/content', () => ({
  getAllBlogPosts: () => POSTS,
  getBlogPostsByLocale: (locale: string) => POSTS.filter((post) => post.locale === locale),
  getBlogPostBySlug: (locale: string, slug: string) =>
    POSTS.find((post) => post.locale === locale && post.slug === slug),
}));
vi.mock('@/lib/public-quiz-sitemap', () => ({ loadPublicQuizSitemapEntries: async () => [] }));
vi.mock('@/lib/quiz-topic-hub-factory', () => ({
  getQuizTopicHubService: () => ({ listIndexableTopics: async () => [] }),
}));
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

  it('lists a vi-only article only under /vi, with vi and x-default alternates (RIN-1312)', async () => {
    const entries = await buildPublicSitemapEntries('test');
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
    const path = `/blog/${VI_ONLY.slug}`;

    expect(byUrl.has(canonicalFor('en', path))).toBe(false);
    expect(byUrl.get(canonicalFor('vi', path))?.alternates?.languages).toEqual({
      vi: canonicalFor('vi', path),
      'x-default': canonicalFor('vi', path),
    });
  });

  it('keeps both locales, alternates and x-default for an article that exists in both (RIN-1312)', async () => {
    const entries = await buildPublicSitemapEntries('test');
    const path = `/blog/${SAMPLE.slug}`;
    const both = {
      vi: canonicalFor('vi', path),
      en: canonicalFor('en', path),
      'x-default': canonicalFor('vi', path),
    };
    const articleEntries = entries.filter((entry) => entry.url.endsWith(path));

    expect(articleEntries).toEqual([
      {
        url: canonicalFor('en', path),
        lastModified: expect.any(Date),
        alternates: { languages: both },
      },
      {
        url: canonicalFor('vi', path),
        lastModified: expect.any(Date),
        alternates: { languages: both },
      },
    ]);
  });

  it('gives a vi-only article no en hreflang alternate in its metadata (RIN-1312)', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'vi', slug: VI_ONLY.slug }),
    });
    const path = `/blog/${VI_ONLY.slug}`;

    expect(metadata.alternates?.languages).toEqual({
      vi: canonicalFor('vi', path),
      'x-default': canonicalFor('vi', path),
    });
    expect(
      await generateMetadata({ params: Promise.resolve({ locale: 'en', slug: VI_ONLY.slug }) }),
    ).toEqual({});
  });

  it('keeps every hreflang alternate for an article in both locales (RIN-1312)', async () => {
    const path = `/blog/${SAMPLE.slug}`;
    for (const locale of ['en', 'vi']) {
      const metadata = await generateMetadata({ params: params(locale) });
      expect(metadata.alternates?.languages).toEqual({
        vi: canonicalFor('vi', path),
        en: canonicalFor('en', path),
        'x-default': canonicalFor('vi', path),
      });
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
