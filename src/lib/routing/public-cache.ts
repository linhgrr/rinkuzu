/**
 * Signed-out twin routes (RIN-1646, RIN-1647, spec RIN-1642 AC 1 and AC 3).
 *
 * The `(app)` layout reads the session, so every page in it renders per
 * request. For a visitor with no session cookie at all, the proxy rewrites
 * `/{locale}/explore`, `/{locale}/explore/<topic>` and `/{locale}/quiz/<slug>`
 * to a twin under `/{locale}/signed-out/...` that reads no session, cookie or
 * header and is served from the cache. Any session cookie, valid or not, keeps
 * the dynamic route, so a signed-in learner sees exactly what they saw before.
 *
 * A quiz page changes with its query (`mode`, `entry`, `retryOf`, `post`,
 * `topic`), which a cached page cannot read, so only a request with no query
 * at all reaches the quiz twin. `/flashcards` and `/result` are other paths.
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

const EXPLORE_PATH = /^\/(vi|en)\/explore(\/[^/]+)?\/?$/;
const QUIZ_PATH = /^\/(vi|en)\/quiz\/([^/]+)\/?$/;
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
  search = '',
): string | null {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const explore = EXPLORE_PATH.exec(pathname);
  const quiz = explore ? null : QUIZ_PATH.exec(pathname);
  if ((!explore && !quiz) || hasSessionCookie(cookieNames)) return null;
  if (explore) {
    const [, locale, topic = ''] = explore;
    return `/${locale}/${SIGNED_OUT_TWIN_SEGMENT}/explore${topic}`;
  }
  // A quiz page with any query keeps the dynamic route (see the header comment).
  if (quiz && (search === '' || search === '?')) {
    return `/${quiz[1]}/${SIGNED_OUT_TWIN_SEGMENT}/quiz/${quiz[2]}`;
  }
  return null;
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
