import type { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';

type StaticPublicRoute = (typeof INDEXABLE_STATIC_PUBLIC_ROUTES)[number];

/**
 * Sitemap `lastmod` (`YYYY-MM-DD`, UTC) of each static public page (RIN-1499).
 * Search engines trust `lastmod` only while it tracks real changes, so it is a
 * constant, never the request time. A route added to
 * `INDEXABLE_STATIC_PUBLIC_ROUTES` without a date here fails typecheck.
 * `/blog` and `/blog/authors` also move with their newest post
 * (`getBlogLastModified`); this date covers their own page copy.
 */
// Bump the date when the page's copy changes.
export const STATIC_ROUTE_LASTMOD: Readonly<Record<StaticPublicRoute, string>> = {
  '/': '2026-11-10',
  '/explore': '2026-11-10',
  '/quizzes': '2026-11-04',
  '/premium-quizzes': '2026-11-07',
  '/adaptive': '2026-11-10',
  '/faq': '2026-11-03',
  '/pricing': '2026-11-09',
  '/privacy': '2026-11-09',
  '/terms': '2026-11-09',
  '/cookies': '2026-07-30',
  '/about': '2026-11-03',
  '/contact': '2026-07-30',
  '/blog': '2026-11-10',
  '/blog/authors': '2026-11-10',
};
