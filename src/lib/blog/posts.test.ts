import { describe, expect, it } from 'vitest';
import { getBlogAuthor } from './authors';
import { getAllBlogPosts } from './content';
import {
  blogImageAt,
  formatBlogDate,
  formatReadTime,
  getAdjacentBlogArticles,
  getBlogArticle,
  getBlogArticleLocales,
  getBlogArticleSlugs,
  getBlogAuthorSlugs,
  getBlogIndexPosts,
  getBlogSitemapRoutes,
  toBlogLocale,
} from './posts';

describe('blog post queries', () => {
  it('formats dates and read times per locale', () => {
    expect(formatBlogDate('2026-03-27', 'en')).toBe('March 27, 2026');
    expect(formatBlogDate('2026-03-07', 'vi')).toBe('7 tháng 3, 2026');
    expect(formatReadTime(8, 'en')).toBe('8 min read');
    expect(formatReadTime(8, 'vi')).toBe('8 phút đọc');
  });

  it('resizes Unsplash images only', () => {
    expect(blogImageAt('https://images.unsplash.com/photo-1?w=1200&q=80', 800)).toBe(
      'https://images.unsplash.com/photo-1?w=800&q=80',
    );
    expect(blogImageAt('/images/blog/hero.jpg', 800)).toBe('/images/blog/hero.jpg');
  });

  it('reads any non-vi route locale as English', () => {
    expect(toBlogLocale('vi')).toBe('vi');
    expect(toBlogLocale('en')).toBe('en');
    expect(toBlogLocale('fr')).toBe('en');
  });

  it('falls back to the English article when the translation has no body', () => {
    const vi = getBlogIndexPosts('vi').find((post) => post.content.trim() === '');
    expect(vi).toBeDefined();
    const article = getBlogArticle('vi', vi?.slug ?? '');
    expect(article?.locale).toBe('en');
    expect(article?.content.trim()).not.toBe('');
  });

  it('has no article for an unknown slug', () => {
    expect(getBlogArticle('en', 'no-such-post')).toBeUndefined();
    expect(getBlogArticleSlugs()).not.toContain('no-such-post');
  });

  it('orders neighbours newest first', () => {
    const [newest, older] = getBlogIndexPosts('en');
    expect(newest && older && newest.date >= older.date).toBe(true);
    if (!newest || !older) return;
    expect(getAdjacentBlogArticles(newest)).toEqual({ previous: undefined, next: older });
    expect(getAdjacentBlogArticles(older).previous).toBe(newest);
  });

  it('gives every post an author profile and every slug an article', () => {
    for (const slug of getBlogAuthorSlugs()) {
      expect(getBlogAuthor(slug)).toBeDefined();
    }
    for (const post of getAllBlogPosts()) {
      expect(getBlogArticle(post.locale, post.slug)).toBeDefined();
    }
  });

  it('derives sitemap routes for every article and author from content/blog (RIN-406)', () => {
    expect(getBlogSitemapRoutes()).toEqual(
      expect.arrayContaining([
        {
          path: '/blog/ai-powered-quiz-generation-guide',
          lastModified: '2026-03-27',
          locales: ['vi', 'en'],
        },
        {
          path: '/blog/knowledge-graphs-adaptive-learning-pdfs',
          lastModified: '2026-03-20',
          locales: ['vi', 'en'],
        },
        { path: '/blog/authors/rinkuzu-team', lastModified: expect.any(String) },
      ]),
    );
  });

  it('lists the locales an article resolves in; a vi listing-only file counts for vi (RIN-1312)', () => {
    expect(getBlogArticleLocales('ai-powered-quiz-generation-guide')).toEqual(['vi', 'en']);
    expect(getBlogArticleLocales('no-such-post')).toEqual([]);
  });
});
