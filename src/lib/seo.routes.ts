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
  // Guest PDF tool; `/try/pdf/play` and guest-draft URLs stay `noindex` and out of the sitemap (RIN-1497).
  '/try/pdf',
  // Blog post and author routes come from content/blog (getBlogSitemapRoutes, RIN-406).
] as const;

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
