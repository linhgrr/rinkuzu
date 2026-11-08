import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BlogContentError,
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostsByLocale,
  loadBlogPosts,
  parseFrontmatter,
} from './content';

const fixtureRoot = (name: string): string => path.join(__dirname, '__fixtures__', name);

describe('loadBlogPosts', () => {
  it('parses a valid post into a typed BlogPost', () => {
    const posts = loadBlogPosts(fixtureRoot('valid'));

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: 'valid-post',
      locale: 'en',
      title: 'A Valid Post',
      description: 'This post has every required frontmatter field.',
      date: '2026-01-15',
      category: 'Guides',
      readTimeMinutes: 6,
      heroImage: '/images/blog/valid-post.jpg',
      heroImageAlt: 'A laptop showing a quiz dashboard',
      author: 'rinkuzu-team',
    });
    expect(posts[0]?.content).toContain('Body content goes here.');
    expect(posts[0]?.content).not.toContain('title:');
  });

  it('throws when a required frontmatter field is missing', () => {
    expect(() => loadBlogPosts(fixtureRoot('invalid'))).toThrow(BlogContentError);
    expect(() => loadBlogPosts(fixtureRoot('invalid'))).toThrow(/description/);
  });

  it('throws when a frontmatter field has the wrong type', () => {
    expect(() => loadBlogPosts(fixtureRoot('bad-type'))).toThrow(/readTimeMinutes/);
  });

  it('throws when a file has no frontmatter block', () => {
    expect(() => loadBlogPosts(fixtureRoot('no-frontmatter'))).toThrow(/Missing frontmatter/);
  });

  it('throws when the frontmatter locale does not match its directory', () => {
    expect(() => loadBlogPosts(fixtureRoot('locale-mismatch'))).toThrow(
      /locale "en".*does not match its directory "vi"/,
    );
  });

  it('throws when the file name is not a URL-safe slug', () => {
    expect(() => loadBlogPosts(fixtureRoot('bad-slug'))).toThrow(/Invalid slug "Bad_Slug"/);
  });

  it('returns an empty array when the content root does not exist', () => {
    expect(loadBlogPosts(fixtureRoot('does-not-exist'))).toEqual([]);
  });
});

describe('parseFrontmatter', () => {
  it('handles CRLF line endings and a BOM', () => {
    const raw = '﻿---\r\ntitle: Hello\r\ndate: 2026-01-15\r\n---\r\nBody\r\n';
    expect(parseFrontmatter(raw, 'x.mdx')).toEqual({
      data: { title: 'Hello', date: '2026-01-15' },
      content: 'Body\r\n',
    });
  });

  it('wraps YAML syntax errors in BlogContentError', () => {
    const raw = '---\ntitle: [unclosed\n---\nBody\n';
    expect(() => parseFrontmatter(raw, 'broken.mdx')).toThrow(BlogContentError);
    expect(() => parseFrontmatter(raw, 'broken.mdx')).toThrow(
      /Invalid YAML frontmatter in broken\.mdx/,
    );
  });
});

// Build gate: every real post under content/blog must validate, so a bad
// frontmatter field fails CI before any page can render it.
describe('content/blog', () => {
  it('contains only valid posts with unique slugs per locale', () => {
    const posts = getAllBlogPosts();
    const keys = posts.map((post) => `${post.locale}/${post.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const post of posts) {
      expect(getBlogPostBySlug(post.locale, post.slug)).toBe(post);
      expect(getBlogPostsByLocale(post.locale)).toContain(post);
    }
  });

  it('returns undefined for an unknown slug', () => {
    expect(getBlogPostBySlug('en', 'no-such-post-slug')).toBeUndefined();
  });
});
