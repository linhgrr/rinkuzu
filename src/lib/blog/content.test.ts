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
import { blogFrontmatterSchema } from './schema';

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

describe('loadBlogPosts body safety (RIN-1329)', () => {
  it('rejects code in a body with the file and line', () => {
    const load = () => loadBlogPosts(fixtureRoot('unsafe-body'));
    expect(load).toThrow(BlogContentError);
    // Line 17 of the file: 11 frontmatter lines, then blank, heading, blank, prose, blank.
    expect(load).toThrow(/unsafe-body[\\/]en[\\/]script-tag\.mdx:17: raw HTML\/JSX tag `<script`/);
  });

  it('accepts code blocks, code spans, escapes, tables and safe links', () => {
    const [post] = loadBlogPosts(fixtureRoot('safe-body'));
    expect(post?.slug).toBe('code-and-tables');
    expect(post?.content).toContain('<Quiz id={42}');
  });

  it('reads an optional draft flag', () => {
    const [post] = loadBlogPosts(fixtureRoot('valid'));
    expect(post?.draft).toBeUndefined();
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
// frontmatter field or code in a body (RIN-1329) fails CI before any page can
// render it. This is the `test:node` step of `local/ci`.
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

  it('gives every table a delimiter row with as many cells as its header (RIN-1281)', () => {
    // GFM renders a table whose delimiter row has a different cell count as raw "|" text.
    const cells = (row: string): number =>
      row
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|').length;
    const offenders: string[] = [];
    for (const post of getAllBlogPosts()) {
      const lines = post.content.split(/\r?\n/);
      lines.forEach((line, index) => {
        const header = lines[index - 1];
        if (!/^\s*\|?\s*:?-{3,}/.test(line) || header === undefined) return;
        if (cells(line) !== cells(header)) offenders.push(`${post.locale}/${post.slug}: ${header}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getBlogPostBySlug('en', 'no-such-post-slug')).toBeUndefined();
  });
});

// RIN-1331: optional `tags` drive the related-posts block.
describe('blogFrontmatterSchema tags', () => {
  const base = {
    title: 'T',
    description: 'D',
    date: '2026-01-15',
    category: 'Guides',
    readTimeMinutes: 5,
    heroImage: '/h.jpg',
    heroImageAlt: 'A',
    locale: 'en',
    author: 'rinkuzu-team',
  };

  it('is optional and trims each tag', () => {
    expect(blogFrontmatterSchema.parse(base).tags).toBeUndefined();
    expect(blogFrontmatterSchema.parse({ ...base, tags: [' pdf ', 'quiz'] }).tags).toEqual([
      'pdf',
      'quiz',
    ]);
  });

  it('rejects empty tags and more than eight', () => {
    expect(blogFrontmatterSchema.safeParse({ ...base, tags: ['pdf', '  '] }).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, index) => `tag-${index}`);
    expect(blogFrontmatterSchema.safeParse({ ...base, tags: nine }).success).toBe(false);
  });
});
