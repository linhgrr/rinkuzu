/**
 * Cache-Control for public read-only catalog APIs (RIN-1644).
 *
 * Vercel's CDN keys its cache on the URL, not on cookies, so a cached response
 * is served to every visitor of that URL, signed in or not. A route may only
 * send the public header for a URL whose response never depends on the
 * session: the handler did not read the session to build it.
 */
const PUBLIC_CATALOG_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=86400';

const PRIVATE_NO_STORE_CACHE_CONTROL = 'private, no-store';

interface CatalogCacheInput {
  /** True when the handler read the session (or may serve per-user data) for this URL. */
  readsSession: boolean;
}

export function catalogCacheHeaders({ readsSession }: CatalogCacheInput): {
  'Cache-Control': string;
} {
  return {
    'Cache-Control': readsSession ? PRIVATE_NO_STORE_CACHE_CONTROL : PUBLIC_CATALOG_CACHE_CONTROL,
  };
}
