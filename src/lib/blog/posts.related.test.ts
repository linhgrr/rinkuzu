import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from './content';
import { getRelatedBlogArticles } from './posts';

// RIN-1331: related posts under each article. The content store is faked so
// each test controls exactly which posts compete.
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

const slugs = (posts: BlogPost[]): string[] => posts.map((related) => related.slug);

describe('getRelatedBlogArticles', () => {
  beforeEach(() => {
    store.posts = [];
  });

  it('ranks shared tags over same category over newest', () => {
    const current = post('current', { category: 'Guides', tags: ['pdf', 'quiz'] });
    store.posts = [
      current,
      post('same-category-newest', { category: 'Guides', date: '2026-06-01' }),
      post('one-tag', { category: 'Other', tags: ['PDF'], date: '2026-02-01' }),
      post('two-tags', { category: 'Other', tags: ['quiz', 'pdf'], date: '2026-01-01' }),
      post('one-tag-same-category', { category: 'Guides', tags: ['quiz'], date: '2026-01-01' }),
    ];

    expect(slugs(getRelatedBlogArticles(current))).toEqual([
      'two-tags',
      'one-tag-same-category',
      'one-tag',
    ]);
  });

  it('breaks ties newest first, then by slug', () => {
    const current = post('current');
    store.posts = [
      current,
      post('b-older', { date: '2026-01-01' }),
      post('c-newer', { date: '2026-03-01' }),
      post('a-older', { date: '2026-01-01' }),
    ];

    expect(slugs(getRelatedBlogArticles(current))).toEqual(['c-newer', 'a-older', 'b-older']);
  });

  it('never returns the post itself, another locale or a post without an article', () => {
    const current = post('current', { tags: ['pdf'] });
    store.posts = [
      current,
      post('vietnamese', { locale: 'vi', tags: ['pdf'] }),
      post('draft-without-body', { tags: ['pdf'], content: '  ' }),
    ];

    expect(getRelatedBlogArticles(current)).toEqual([]);
  });

  it('keeps a listing-only translation whose English article exists', () => {
    const current = post('current', { locale: 'vi', category: 'Hướng dẫn', content: '' });
    store.posts = [
      current,
      post('translated', { locale: 'vi', category: 'Hướng dẫn', content: '' }),
      post('translated'),
    ];

    const related = getRelatedBlogArticles(current);
    expect(slugs(related)).toEqual(['translated']);
    expect(related[0]?.locale).toBe('vi');
  });

  it('returns nothing when no post shares a tag or the category', () => {
    const current = post('current', { category: 'Guides', tags: ['pdf'] });
    store.posts = [current, post('unrelated', { category: 'Other', tags: ['math'] })];

    expect(getRelatedBlogArticles(current)).toEqual([]);
  });

  it('returns at most `limit` posts, three by default', () => {
    const current = post('current');
    store.posts = [current, ...['a', 'b', 'c', 'd'].map((slug) => post(slug))];

    expect(getRelatedBlogArticles(current)).toHaveLength(3);
    expect(getRelatedBlogArticles(current, 2)).toHaveLength(2);
  });
});
