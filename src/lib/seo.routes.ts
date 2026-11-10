export const INDEXABLE_STATIC_PUBLIC_ROUTES = [
  '/',
  '/explore',
  '/quizzes',
  '/premium-quizzes',
  '/adaptive',
  '/faq',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
  '/about',
  '/contact',
  '/blog',
  '/blog/authors',
  // Blog post and author routes come from content/blog (getBlogSitemapRoutes, RIN-406).
] as const;

/**
 * Static public pages that carry their own `lastmod`: a constant date kept in code and
 * bumped when the page's content changes, never the request time (RIN-1496 rule).
 * `/try/pdf/play` and guest-draft URLs stay `noindex` and out of the sitemap (RIN-1497).
 */
export const DATED_STATIC_PUBLIC_ROUTES = [
  { path: '/try/pdf', lastModified: '2026-11-10' },
] as const satisfies readonly { path: string; lastModified: string }[];

export const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/profile',
  '/history',
  '/review',
  '/subscription',
  '/create',
  '/adaptive/upload',
  '/adaptive/processing',
  '/adaptive/exercise',
  '/adaptive/subject',
  '/adaptive/result',
  '/draft',
  '/edit',
  '/payment',
  '/quiz/*/result',
  '/test-image-upload',
] as const;
