/**
 * Signed-out twin routes (RIN-1646, spec RIN-1642 AC 1 and AC 3).
 *
 * The `(app)` layout reads the session, so every page in it renders per
 * request. For a visitor with no session cookie at all, the proxy rewrites
 * `/{locale}/explore` and `/{locale}/explore/<topic>` to a twin under
 * `/{locale}/signed-out/...` that reads no session, cookie or header and is
 * served from the cache. Any session cookie, valid or not, keeps the dynamic
 * route, so a signed-in learner sees exactly what they saw before.
 */
const SIGNED_OUT_TWIN_SEGMENT = 'signed-out';

/**
 * Set on the rewritten request. Where the rewrite is proxied rather than served
 * in-process (a self-hosted server whose own origin differs from the request
 * URL), the proxy sees the twin path again and lets a marked request through.
 * Sending it by hand only reaches the same public HTML.
 */
export const SIGNED_OUT_TWIN_HEADER = 'x-rinkuzu-signed-out-twin';

// Auth.js session cookie, plain or `__Secure-`, whole or chunked (`.0`, `.1`).
const SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

const TWIN_PATH = /^\/(vi|en)\/explore(\/[^/]+)?\/?$/;
const INTERNAL_TWIN_PATH = new RegExp(`^/(vi|en)/${SIGNED_OUT_TWIN_SEGMENT}(?=/|$)(.*)$`);

/** Presence only: no decoding, no crypto, no I/O. */
function hasSessionCookie(cookieNames: Iterable<string>): boolean {
  for (const name of cookieNames) {
    if (SESSION_COOKIE.test(name)) return true;
  }
  return false;
}

/** The twin path to rewrite to, or null when the request keeps its route. */
export function signedOutTwinPath(
  method: string,
  pathname: string,
  cookieNames: Iterable<string>,
): string | null {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const match = TWIN_PATH.exec(pathname);
  if (!match || hasSessionCookie(cookieNames)) return null;
  const [, locale, topic = ''] = match;
  return `/${locale}/${SIGNED_OUT_TWIN_SEGMENT}/explore${topic}`;
}

/** A direct request for an internal twin path goes to its public URL instead. */
export function publicPathForInternalTwin(pathname: string): string | null {
  const match = INTERNAL_TWIN_PATH.exec(pathname);
  if (!match) return null;
  const [, locale, rest = ''] = match;
  return `/${locale}${rest}`;
}

/**
 * The public, locale-less pathname for one the router reports. Inside a twin
 * the router sees the rewritten route (`/signed-out/explore`); links, active
 * states and sign-in callbacks must use the URL the visitor is on.
 */
export function publicPathname(pathname: string): string {
  const prefix = `/${SIGNED_OUT_TWIN_SEGMENT}`;
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

/** Edge cache lifetime for public HTML (RIN-1679). */
export const CDN_PUBLIC_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';
export const CDN_NO_STORE = 'no-store';

// Pages every visitor sees alike when signed out. `/quiz/<slug>` joins once
// RIN-1647 makes it a signed-out twin.
const PUBLIC_PAGE_PATH =
  /^\/(?:vi|en)(?:\/(?:(?:about|faq|contact|pricing|privacy|terms|cookies|try|explore)|try\/(?:pdf|text)|blog(?:\/.*)?|explore\/[^/]+))?\/?$/;

export interface CdnCacheInput {
  method: string;
  pathname: string;
  cookieNames: Iterable<string>;
  status: number;
  setsCookie: boolean;
}

/**
 * The `Cloudflare-CDN-Cache-Control` value for a page response: public only for
 * a cookie-less GET/HEAD of an allowlisted path that is a plain 200 without a
 * Set-Cookie. Session cookie presence is enough; no decoding.
 */
export function cdnCacheControlFor(input: CdnCacheInput): string {
  const { method, pathname, cookieNames, status, setsCookie } = input;
  if (method !== 'GET' && method !== 'HEAD') return CDN_NO_STORE;
  if (status !== 200 || setsCookie) return CDN_NO_STORE;
  if (!PUBLIC_PAGE_PATH.test(pathname) || hasSessionCookie(cookieNames)) return CDN_NO_STORE;
  return CDN_PUBLIC_CACHE_CONTROL;
}

/** The internal twin path of a quiz page; `slug` is already URL-encoded. */
export function signedOutTwinQuizPath(locale: string, slug: string): string {
  return `/${locale}/${SIGNED_OUT_TWIN_SEGMENT}/quiz/${slug}`;
}
