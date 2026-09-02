/**
 * Connection deadlines for the fake upstream services the E2E suite boots.
 *
 * Node closes an idle keep-alive connection after 5s by default. The app server
 * reaches these services through undici's connection pool, so a test that
 * spends longer than that on the page leaves a pooled socket idle past the
 * deadline, and the next request can reuse it in the same moment the server is
 * closing it. The app sees ECONNRESET, the request never lands, and the failure
 * surfaces far from its cause — as a page that reloads without the data it just
 * saved.
 *
 * These live in their own module so the guard that protects them can assert the
 * values the server actually uses rather than pattern-match its source.
 */

/** Longer than any gap between upstream calls in the suite. */
export const KEEP_ALIVE_TIMEOUT_MS = 120 * 1000;

/**
 * Must stay above {@link KEEP_ALIVE_TIMEOUT_MS}, or it becomes the earlier
 * deadline and closes the connection the keep-alive was holding open.
 */
export const HEADERS_TIMEOUT_MS = 125 * 1000;
