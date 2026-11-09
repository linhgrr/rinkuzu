import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from './content';
import { canonicalFor } from '@/lib/seo';
import { blogFeedAlternates, buildBlogFeed } from './feed';

// RIN-1330: the per-locale RSS feed lists only that locale's published posts.
// Fake content.
const base: BlogPost = {
  slug: 'older-post',
  title: 'Older post',
  description: 'Older description.',
  date: '2026-09-01',
  category: 'Learning Science',
  readTimeMinutes: 5,
  heroImage: 'https://images.unsplash.com/photo-sample?w=1200&q=80',
  heroImageAlt: 'Sample hero',
  locale: 'en',
  author: 'rinkuzu-team',
  content: '## Body\n\nText.\n',
};

const { POSTS } = vi.hoisted(() => ({ POSTS: [] as BlogPost[] }));
POSTS.push(
  base,
  { ...base, slug: 'newer-post', title: `Q&A <tips> "quoted" 'it'\u0001`, date: '2026-10-01' },
  { ...base, slug: 'draft-post', title: 'Draft post', draft: true },
  { ...base, slug: 'future-post', title: 'Future post', date: '2026-12-31' },
  { ...base, slug: 'bai-tieng-viet', title: 'Bài tiếng Việt', locale: 'vi', category: 'Ôn thi' },
  // A listing-only translation: its page falls back to the English article.
  { ...base, slug: 'newer-post', title: 'Bài mới', locale: 'vi', content: '' },
  // A listing-only translation with no English article has no page.
  { ...base, slug: 'no-page', title: 'Không có trang', locale: 'vi', content: '' },
);

vi.mock('./content', () => ({
  getAllBlogPosts: () => POSTS,
  getBlogPostsByLocale: (locale: string) => POSTS.filter((post) => post.locale === locale),
  getBlogPostBySlug: (locale: string, slug: string) =>
    POSTS.find((post) => post.locale === locale && post.slug === slug),
}));

const NOW = new Date('2026-11-10T12:00:00.000Z');

const itemTitles = (xml: string): string[] =>
  [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map((match) => match[1] ?? '');

describe('buildBlogFeed', () => {
  it('lists the published posts of the locale only, newest first', () => {
    const xml = buildBlogFeed('en', NOW);

    expect(itemTitles(xml)).toEqual([
      'Q&amp;A &lt;tips&gt; &quot;quoted&quot; &apos;it&apos;',
      'Older post',
    ]);
    expect(xml).not.toContain('Draft post');
    expect(xml).not.toContain('Future post');
    expect(xml).not.toContain('Bài tiếng Việt');
  });

  it('includes a future-dated post once its date has come', () => {
    expect(itemTitles(buildBlogFeed('en', new Date('2026-12-31T00:00:00.000Z')))).toContain(
      'Future post',
    );
  });

  it('keeps vi listing translations that have a page and drops those that do not', () => {
    const xml = buildBlogFeed('vi', NOW);

    expect(itemTitles(xml)).toEqual(['Bài tiếng Việt', 'Bài mới']);
    expect(xml).toContain(`<link>${canonicalFor('vi', '/blog/newer-post')}</link>`);
    expect(xml).toContain('<language>vi-VN</language>');
    expect(xml).toContain('<category>Ôn thi</category>');
  });

  it('writes absolute canonical links, RFC 822 dates, the author and the self link', () => {
    const xml = buildBlogFeed('en', NOW);
    const url = canonicalFor('en', '/blog/older-post');

    expect(xml).toContain(`<link>${url}</link>`);
    expect(xml).toContain(`<guid isPermaLink="true">${url}</guid>`);
    expect(xml).toContain('<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>');
    expect(xml).toContain('<lastBuildDate>Thu, 01 Oct 2026 00:00:00 GMT</lastBuildDate>');
    expect(xml).toContain('<dc:creator>RinKuzu Team</dc:creator>');
    expect(xml).toContain('<category>Learning Science</category>');
    expect(xml).toContain(`<atom:link href="${canonicalFor('en', '/blog/rss.xml')}" rel="self"`);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe('blogFeedAlternates', () => {
  it('points each locale at its own absolute feed URL', () => {
    expect(blogFeedAlternates('vi')).toEqual({
      'application/rss+xml': canonicalFor('vi', '/blog/rss.xml'),
    });
  });
});
