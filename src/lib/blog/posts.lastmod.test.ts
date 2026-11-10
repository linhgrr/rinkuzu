import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from './content';
import { getBlogLastModified, getBlogSitemapRoutes } from './posts';

// RIN-1499: a blog URL's sitemap `lastmod` is its last real content change,
// `updated` when the frontmatter has it, else `date`. The content store is faked.
const store = vi.hoisted(() => ({ posts: [] as BlogPost[] }));

vi.mock('./content', () => ({
  getAllBlogPosts: () => store.posts,
  getBlogPostsByLocale: (locale: string) => store.posts.filter((post) => post.locale === locale),
  getBlogPostBySlug: (locale: string, slug: string) =>
    store.posts.find((post) => post.locale === locale && post.slug === slug),
}));

const post = (slug: string, overrides: Partial<BlogPost> = {}): BlogPost => ({
  slug,
  title: `Title ${slug}`,
  description: 'Description',
  date: '2026-01-01',
  category: 'Guides',
  readTimeMinutes: 5,
  heroImage: '/hero.jpg',
  heroImageAlt: 'Hero',
  locale: 'en',
  author: 'rinkuzu-team',
  content: 'Body',
  ...overrides,
});

const NOW = new Date('2026-11-10T12:00:00.000Z');
const lastModifiedOf = (path: string) =>
  getBlogSitemapRoutes(NOW).find((route) => route.path === path)?.lastModified;

describe('blog sitemap lastmod (RIN-1499)', () => {
  beforeEach(() => {
    store.posts = [];
  });

  it('dates an article by `updated` over `date`', () => {
    store.posts = [
      post('revised', { date: '2026-03-01', updated: '2026-10-20' }),
      post('untouched', { date: '2026-04-01' }),
    ];

    expect(lastModifiedOf('/blog/revised')).toBe('2026-10-20');
    expect(lastModifiedOf('/blog/untouched')).toBe('2026-04-01');
  });

  it('takes the newest change across the locales of one article', () => {
    store.posts = [
      post('guide', { date: '2026-03-01' }),
      post('guide', { locale: 'vi', date: '2026-03-01', updated: '2026-09-15', content: '' }),
    ];

    expect(lastModifiedOf('/blog/guide')).toBe('2026-09-15');
  });

  it('dates an author route, /blog and /blog/authors by the newest published change', () => {
    store.posts = [
      post('old-but-revised', { date: '2026-02-01', updated: '2026-10-30' }),
      post('newest-date', { date: '2026-10-01' }),
      // A draft's revision is not public, so it moves no date.
      post('draft', { date: '2026-02-01', updated: '2026-11-05', draft: true }),
    ];

    expect(lastModifiedOf('/blog/authors/rinkuzu-team')).toBe('2026-10-30');
    expect(getBlogLastModified(NOW)).toBe('2026-10-30');
  });

  it('has no blog date without a published post', () => {
    store.posts = [post('scheduled', { date: '2026-12-01' })];

    expect(getBlogLastModified(NOW)).toBeUndefined();
  });
});
