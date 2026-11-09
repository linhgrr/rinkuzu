import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from './content';

const post = (slug: string, date: string, extra: Partial<BlogPost> = {}): BlogPost => ({
  slug,
  date,
  locale: 'en',
  title: `Title ${slug}`,
  description: `Description ${slug}`,
  category: 'Guides',
  readTimeMinutes: 5,
  heroImage: '/images/blog/hero.jpg',
  heroImageAlt: 'Hero',
  author: 'rinkuzu-team',
  content: `Body of ${slug}.`,
  ...extra,
});

const LIVE = post('live-post', '2026-11-01');
const TODAY = post('today-post', '2026-11-09');
const SCHEDULED = post('scheduled-post', '2026-11-10');
const DRAFT = post('draft-post', '2026-11-05', { draft: true });
// A listing-only translation of a scheduled post: no body, falls back to `en`.
const SCHEDULED_VI = post('scheduled-post', '2026-11-10', { locale: 'vi', content: '' });
const ALL = [LIVE, TODAY, SCHEDULED, DRAFT, SCHEDULED_VI];

vi.mock('./content', () => ({
  getAllBlogPosts: () => ALL,
  getBlogPostsByLocale: (locale: string) => ALL.filter((p) => p.locale === locale),
  getBlogPostBySlug: (locale: string, slug: string) =>
    ALL.find((p) => p.locale === locale && p.slug === slug),
}));

const {
  getAdjacentBlogArticles,
  getBlogArticle,
  getBlogArticleLocales,
  getBlogArticleSlugs,
  getBlogAuthorSlugs,
  getBlogIndexPosts,
  getBlogPostsByAuthor,
  getBlogSitemapRoutes,
  getRelatedBlogArticles,
  isPublished,
} = await import('./posts');

// 23:30 UTC on 2026-11-09 is already 2026-11-10 in Vietnam: UTC decides.
const NOW = new Date('2026-11-09T23:30:00.000Z');
const NEXT_DAY = new Date('2026-11-10T00:00:00.000Z');
const slugs = (posts: BlogPost[]) => posts.map((p) => p.slug);

describe('isPublished (RIN-1329)', () => {
  it('publishes past and today, not future dates or drafts', () => {
    expect(isPublished(LIVE, NOW)).toBe(true);
    expect(isPublished(TODAY, NOW)).toBe(true);
    expect(isPublished(SCHEDULED, NOW)).toBe(false);
    expect(isPublished(DRAFT, NOW)).toBe(false);
  });

  it('publishes a scheduled post from midnight UTC of its date, a draft never', () => {
    expect(isPublished(SCHEDULED, NEXT_DAY)).toBe(true);
    expect(isPublished(DRAFT, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
    expect(isPublished({ ...DRAFT, draft: false }, NOW)).toBe(true);
  });
});

describe('blog queries skip unpublished posts', () => {
  it('leaves drafts and scheduled posts off the index and author lists', () => {
    expect(slugs(getBlogIndexPosts('en', NOW))).toEqual(['today-post', 'live-post']);
    expect(slugs(getBlogPostsByAuthor('en', 'rinkuzu-team', NOW))).toEqual([
      'today-post',
      'live-post',
    ]);
    expect(getBlogIndexPosts('vi', NOW)).toEqual([]);
  });

  it('has no route for drafts or scheduled posts until their day', () => {
    expect(getBlogArticle('en', 'draft-post', NOW)).toBeUndefined();
    expect(getBlogArticle('en', 'scheduled-post', NOW)).toBeUndefined();
    expect(getBlogArticle('vi', 'scheduled-post', NOW)).toBeUndefined();
    expect(getBlogArticleSlugs(NOW)).toEqual(['live-post', 'today-post']);

    expect(getBlogArticle('en', 'scheduled-post', NEXT_DAY)).toBe(SCHEDULED);
    expect(getBlogArticle('vi', 'scheduled-post', NEXT_DAY)).toBe(SCHEDULED);
  });

  it('skips unpublished neighbours in previous/next links', () => {
    expect(getAdjacentBlogArticles(TODAY, NOW)).toEqual({ previous: undefined, next: LIVE });
    expect(getAdjacentBlogArticles(TODAY, NEXT_DAY)).toEqual({ previous: SCHEDULED, next: LIVE });
  });

  it('keeps drafts and scheduled posts out of the sitemap and author dates', () => {
    expect(getBlogSitemapRoutes(NOW)).toEqual([
      { path: '/blog/live-post', lastModified: '2026-11-01', locales: ['vi', 'en'] },
      { path: '/blog/today-post', lastModified: '2026-11-09', locales: ['vi', 'en'] },
      { path: '/blog/authors/rinkuzu-team', lastModified: '2026-11-09' },
    ]);
    expect(getBlogSitemapRoutes(NEXT_DAY)).toContainEqual({
      path: '/blog/scheduled-post',
      lastModified: '2026-11-10',
      locales: ['vi', 'en'],
    });
  });

  it('lists hreflang locales only once the article is published', () => {
    expect(getBlogArticleLocales('scheduled-post', NOW)).toEqual([]);
    expect(getBlogArticleLocales('scheduled-post', NEXT_DAY)).toEqual(['vi', 'en']);
    expect(getBlogArticleLocales('draft-post', NEXT_DAY)).toEqual([]);
  });

  it('leaves drafts and scheduled posts out of related posts until their day', () => {
    expect(slugs(getRelatedBlogArticles(LIVE, 3, NOW))).toEqual(['today-post']);
    expect(slugs(getRelatedBlogArticles(LIVE, 3, NEXT_DAY))).toEqual([
      'scheduled-post',
      'today-post',
    ]);
  });

  it('drops an author whose only posts are unpublished', () => {
    expect(getBlogAuthorSlugs(new Date('2026-10-01T00:00:00.000Z'))).toEqual([]);
  });
});
