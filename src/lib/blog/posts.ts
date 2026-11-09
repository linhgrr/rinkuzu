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

/** `YYYY-MM-DD` of `now` in UTC, comparable with frontmatter `date`. */
const utcDateKey = (now: Date): string => now.toISOString().slice(0, 10);

/**
 * The single publication rule (RIN-1329): a post is live unless it is a
 * `draft`, or its `date` is after today (UTC). Every list, the sitemap and the
 * post route go through it; pages revalidate hourly, so a scheduled post
 * appears on its date without a deploy.
 *
 * @public The RSS feed (RIN-1259 part B) filters with it too.
 */
export const isPublished = (post: BlogPost, now: Date = new Date()): boolean =>
  post.draft !== true && post.date <= utcDateKey(now);

const published = (posts: BlogPost[], now: Date): BlogPost[] =>
  posts.filter((post) => isPublished(post, now));

const publishedPost = (post: BlogPost | undefined, now: Date): BlogPost | undefined =>
  post && isPublished(post, now) ? post : undefined;

const byNewestFirst = (a: BlogPost, b: BlogPost): number =>
  b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);

/** Published posts listed on `/<locale>/blog`, newest first. */
export const getBlogIndexPosts = (locale: Locale, now: Date = new Date()): BlogPost[] =>
  published(getBlogPostsByLocale(locale), now).sort(byNewestFirst);

/** Published posts by one author on `/<locale>/blog/authors/<author>`, newest first. */
export const getBlogPostsByAuthor = (
  locale: Locale,
  author: string,
  now: Date = new Date(),
): BlogPost[] => getBlogIndexPosts(locale, now).filter((post) => post.author === author);

/** Slugs of every author who has at least one published post. */
export const getBlogAuthorSlugs = (now: Date = new Date()): string[] => [
  ...new Set(published(getAllBlogPosts(), now).map((post) => post.author)),
];

/**
 * The article rendered at `/<locale>/blog/<slug>`: the locale's own published
 * post when it has a body, otherwise the published post from
 * {@link ARTICLE_SOURCE_LOCALE}.
 */
export const getBlogArticle = (
  locale: Locale,
  slug: string,
  now: Date = new Date(),
): BlogPost | undefined => {
  const localized = publishedPost(getBlogPostBySlug(locale, slug), now);
  if (localized && hasBody(localized)) {
    return localized;
  }
  const source = publishedPost(getBlogPostBySlug(ARTICLE_SOURCE_LOCALE, slug), now);
  return source && hasBody(source) ? source : undefined;
};

/** Every slug that has a published article page, for `generateStaticParams`. */
export const getBlogArticleSlugs = (now: Date = new Date()): string[] => [
  ...new Set(
    published(getAllBlogPosts(), now)
      .filter(hasBody)
      .map((post) => post.slug),
  ),
];

/**
/**
 * Locales whose `/<locale>/blog/<slug>` renders a published article, in
 * {@link locales} order. A listing-only translation counts, since its page
 * falls back to the source article; a post with no source-locale body exists
 * only in its own.
 */
export const getBlogArticleLocales = (slug: string, now: Date = new Date()): Locale[] =>
  locales.filter((locale) => getBlogArticle(locale, slug, now) !== undefined);

/**
 * Neighbours of an article among the published articles in its locale, newest
 * first: `previous` is the next newer post and `next` the next older one.
 */
export const getAdjacentBlogArticles = (
  article: BlogPost,
  now: Date = new Date(),
): { previous: BlogPost | undefined; next: BlogPost | undefined } => {
  const articles = getBlogIndexPosts(article.locale, now).filter(hasBody);
  const index = articles.findIndex((post) => post.slug === article.slug);
  if (index === -1) {
    return { previous: undefined, next: undefined };
  }
  return { previous: articles[index - 1], next: articles[index + 1] };
};

const RELATED_POSTS_LIMIT = 3;

const tagsOf = (post: BlogPost): Set<string> =>
  new Set((post.tags ?? []).map((tag) => tag.toLowerCase()));

type RelatedCandidate = { post: BlogPost; sharedTags: number; sameCategory: boolean };

const byRelevance = (a: RelatedCandidate, b: RelatedCandidate): number =>
  b.sharedTags - a.sharedTags ||
  Number(b.sameCategory) - Number(a.sameCategory) ||
  byNewestFirst(a.post, b.post);

/**
 * Posts related to `post` in its own locale (RIN-1331): a candidate shares at
 * least one tag or the category, and has an article page (its own body or the
 * English one). Most shared tags first, then same category, then newest; never
 * the post itself, and never a draft or scheduled post ({@link isPublished}). Pass
 * the locale's listing post, so a `vi` page gets `vi` cards.
 */
export const getRelatedBlogArticles = (
  post: BlogPost,
  limit: number = RELATED_POSTS_LIMIT,
  now: Date = new Date(),
): BlogPost[] => {
  const tags = tagsOf(post);
  return published(getBlogPostsByLocale(post.locale), now)
    .filter(
      (candidate) =>
        candidate.slug !== post.slug && getBlogArticle(candidate.locale, candidate.slug, now),
    )
    .map((candidate) => ({
      post: candidate,
      sharedTags: [...tagsOf(candidate)].filter((tag) => tags.has(tag)).length,
      sameCategory: candidate.category === post.category,
    }))
    .filter(({ sharedTags, sameCategory }) => sharedTags > 0 || sameCategory)
    .sort(byRelevance)
    .slice(0, limit)
    .map((candidate) => candidate.post);
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
 * Article and author routes for the sitemap, derived from the published posts
 * in content/blog: one per article slug and one per author with a profile, so
 * a new post needs no hand-written sitemap entry.
 */
export const getBlogSitemapRoutes = (now: Date = new Date()): BlogSitemapRoute[] => {
  const posts = published(getAllBlogPosts(), now);
  const articles = getBlogArticleSlugs(now).map((slug) => ({
    path: `/blog/${slug}`,
    lastModified: newestDate(posts.filter((post) => post.slug === slug)),
    locales: getBlogArticleLocales(slug, now),
  }));
  const authors = getBlogAuthorSlugs(now)
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
