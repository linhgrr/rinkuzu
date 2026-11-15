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
export const SIGNED_OUT_TWIN_SEGMENT = 'signed-out';

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
export function hasSessionCookie(cookieNames: Iterable<string>): boolean {
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
