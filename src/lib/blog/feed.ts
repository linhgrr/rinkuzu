import type { Locale } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';
import { getBlogAuthor } from './authors';
import { getBlogArticle, getBlogIndexPosts } from './posts';

/** Path of a locale's blog feed, under `/<locale>` (RIN-1330). */
export const BLOG_FEED_PATH = '/blog/rss.xml';

export const BLOG_FEED_CONTENT_TYPE = 'application/rss+xml; charset=utf-8';

const FEED_COPY: Record<Locale, { title: string; description: string; language: string }> = {
  vi: {
    title: 'Blog RinKuzu',
    description:
      'Bài viết về học cá nhân hóa, AI trong giáo dục, đồ thị kiến thức và cách biến PDF thành lộ trình luyện tập.',
    language: 'vi-VN',
  },
  en: {
    title: 'RinKuzu Blog',
    description:
      'Insights on personalized learning, AI in education, knowledge graphs, and turning PDFs into practice.',
    language: 'en-US',
  },
};

/** Absolute URL of the `locale` blog feed. */
const blogFeedUrl = (locale: Locale): string => canonicalFor(locale, BLOG_FEED_PATH);

/** `alternates.types` entry that links the feed from a blog page's `<head>`. */
export const blogFeedAlternates = (locale: Locale): Record<string, string> => ({
  'application/rss+xml': blogFeedUrl(locale),
});

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

// Characters XML 1.0 forbids even when escaped (C0 controls except tab, LF, CR).
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Escapes text for an XML element or attribute value. */
const escapeXml = (text: string): string =>
  text.replace(XML_FORBIDDEN, '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

/** `2026-03-27` → `Fri, 27 Mar 2026 00:00:00 GMT` (RFC 822, as RSS 2.0 requires). */
const toRfc822 = (isoDate: string): string => new Date(`${isoDate}T00:00:00.000Z`).toUTCString();

const element = (name: string, text: string): string => `<${name}>${escapeXml(text)}</${name}>`;

/**
 * RSS 2.0 feed of the `locale` blog: the published posts listed on
 * `/<locale>/blog` that have an article page, newest first (drafts and
 * future-dated posts are left out by `isPublished`). The author goes in
 * `dc:creator`, since RSS `<author>` must be an email address.
 */
export const buildBlogFeed = (locale: Locale, now: Date = new Date()): string => {
  const copy = FEED_COPY[locale];
  const posts = getBlogIndexPosts(locale, now).filter((post) =>
    getBlogArticle(locale, post.slug, now),
  );
  const items = posts.map((post) => {
    const url = canonicalFor(locale, `/blog/${post.slug}`);
    const author = getBlogAuthor(post.author, locale)?.name ?? post.author;
    return [
      '    <item>',
      `      ${element('title', post.title)}`,
      `      ${element('link', url)}`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      ${element('description', post.description)}`,
      `      ${element('pubDate', toRfc822(post.date))}`,
      `      ${element('dc:creator', author)}`,
      `      ${element('category', post.category)}`,
      '    </item>',
    ].join('\n');
  });
  const lastBuild = posts[0] ? [`    ${element('lastBuildDate', toRfc822(posts[0].date))}`] : [];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    ${element('title', copy.title)}`,
    `    ${element('link', canonicalFor(locale, '/blog'))}`,
    `    ${element('description', copy.description)}`,
    `    ${element('language', copy.language)}`,
    ...lastBuild,
    `    <atom:link href="${escapeXml(blogFeedUrl(locale))}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
};
