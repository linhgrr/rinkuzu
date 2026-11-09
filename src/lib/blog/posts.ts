import { locales, type Locale } from '@/i18n/config';
import { getBlogAuthor } from './authors';
import { getAllBlogPosts, getBlogPostBySlug, getBlogPostsByLocale, type BlogPost } from './content';

/**
 * Locale that holds the full article bodies. A post in another locale may be
 * a listing-only translation (frontmatter, no body): it localizes the blog
 * index and author cards, and its article page falls back to this locale.
 */
const ARTICLE_SOURCE_LOCALE: Locale = 'en';

/** Route `locale` param → content locale; anything but `vi` reads as English. */
export const toBlogLocale = (locale: string): Locale => (locale === 'vi' ? 'vi' : 'en');

const hasBody = (post: BlogPost): boolean => post.content.trim().length > 0;

const byNewestFirst = (a: BlogPost, b: BlogPost): number =>
  b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);

/** Posts listed on `/<locale>/blog`, newest first. */
export const getBlogIndexPosts = (locale: Locale): BlogPost[] =>
  [...getBlogPostsByLocale(locale)].sort(byNewestFirst);

/** Posts by one author on `/<locale>/blog/authors/<author>`, newest first. */
export const getBlogPostsByAuthor = (locale: Locale, author: string): BlogPost[] =>
  getBlogIndexPosts(locale).filter((post) => post.author === author);

/** Slugs of every author who has at least one post. */
export const getBlogAuthorSlugs = (): string[] => [
  ...new Set(getAllBlogPosts().map((post) => post.author)),
];

/**
 * The article rendered at `/<locale>/blog/<slug>`: the locale's own post when
 * it has a body, otherwise the post from {@link ARTICLE_SOURCE_LOCALE}.
 */
export const getBlogArticle = (locale: Locale, slug: string): BlogPost | undefined => {
  const localized = getBlogPostBySlug(locale, slug);
  if (localized && hasBody(localized)) {
    return localized;
  }
  const source = getBlogPostBySlug(ARTICLE_SOURCE_LOCALE, slug);
  return source && hasBody(source) ? source : undefined;
};

/** Every slug that has an article page, for `generateStaticParams`. */
export const getBlogArticleSlugs = (): string[] => [
  ...new Set(
    getAllBlogPosts()
      .filter(hasBody)
      .map((post) => post.slug),
  ),
];

/**
 * Locales whose `/<locale>/blog/<slug>` renders an article, in {@link locales}
 * order. A listing-only translation counts, since its page falls back to the
 * source article; a post with no source-locale body exists only in its own.
 */
export const getBlogArticleLocales = (slug: string): Locale[] =>
  locales.filter((locale) => getBlogArticle(locale, slug) !== undefined);

/**
 * Neighbours of an article among the articles in its locale, newest first:
 * `previous` is the next newer post and `next` the next older one.
 */
export const getAdjacentBlogArticles = (
  article: BlogPost,
): { previous: BlogPost | undefined; next: BlogPost | undefined } => {
  const articles = getBlogPostsByLocale(article.locale).filter(hasBody).sort(byNewestFirst);
  const index = articles.findIndex((post) => post.slug === article.slug);
  return { previous: articles[index - 1], next: articles[index + 1] };
};

/**
 * A blog route for the sitemap, dated by the newest post behind it (`YYYY-MM-DD`).
 * `locales` limits an article to the locales it exists in; without it the route
 * exists in every locale.
 */
type BlogSitemapRoute = { path: string; lastModified: string; locales?: Locale[] };

const newestDate = (posts: BlogPost[]): string =>
  posts.reduce((newest, post) => (post.date > newest ? post.date : newest), '');

/**
 * Article and author routes for the sitemap, derived from content/blog: one per
 * article slug and one per author with a profile, so a new post needs no
 * hand-written sitemap entry.
 */
export const getBlogSitemapRoutes = (): BlogSitemapRoute[] => {
  const posts = getAllBlogPosts();
  const articles = getBlogArticleSlugs().map((slug) => ({
    path: `/blog/${slug}`,
    lastModified: newestDate(posts.filter((post) => post.slug === slug)),
    locales: getBlogArticleLocales(slug),
  }));
  const authors = getBlogAuthorSlugs()
    .filter((author) => getBlogAuthor(author))
    .map((author) => ({
      path: `/blog/authors/${author}`,
      lastModified: newestDate(posts.filter((post) => post.author === author)),
    }));
  return [...articles, ...authors];
};

const VI_MONTH_PREFIX = 'tháng';

/** `2026-03-27` → `March 27, 2026` (en) or `27 tháng 3, 2026` (vi). */
export const formatBlogDate = (isoDate: string, locale: Locale): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (locale === 'vi') {
    return `${day} ${VI_MONTH_PREFIX} ${month}, ${year}`;
  }
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/** `8 min read` (en) or `8 phút đọc` (vi). */
export const formatReadTime = (minutes: number, locale: Locale): string =>
  locale === 'vi' ? `${minutes} phút đọc` : `${minutes} min read`;

/**
 * Sets the width of an Unsplash image URL (`?w=`); other URLs are returned
 * unchanged. Frontmatter stores the full-size hero, cards ask for less.
 */
export const blogImageAt = (url: string, width: number): string => {
  if (!url.startsWith('https://images.unsplash.com/')) {
    return url;
  }
  const parsed = new URL(url);
  parsed.searchParams.set('w', String(width));
  return parsed.toString();
};
