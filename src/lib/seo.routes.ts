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
  // Guest pasted-text tool; `/try/text/play` stays `noindex` and out of the sitemap (RIN-1540).
  '/try/text',
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

/**
 * Public pages with nothing to index: crawlers rendering them only burns
 * Function CPU (RIN-1644). They stay reachable for learners and keep their
 * `noindex` metadata. `/try/pdf`, `/try/text` and `/quiz/<slug>` stay allowed.
 */
export const NON_INDEXABLE_CRAWL_PREFIXES = [
  '/try/pdf/play',
  '/try/text/play',
  '/quiz/*/flashcards',
  // Search and filter variants of the explore list; `/explore` and the topic
  // hubs `/explore/<topic>` stay allowed.
  '/explore?',
] as const;
