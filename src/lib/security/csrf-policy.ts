const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Prefix exemptions are reserved for route families whose handlers provide
 * their own request-authenticity checks.
 */
const CSRF_EXEMPT_API_PREFIXES = ['/api/auth/', '/api/billing/webhooks/'];

/**
 * Exact exemptions avoid accidentally exempting similarly named endpoints.
 * Each handler must authenticate the caller independently.
 */
const CSRF_EXEMPT_API_PATHS = new Set([
  '/api/internal/communications/worker',
  // Driven by the Cloudflare billing scheduler, which is server-to-server and
  // therefore sends no Origin, Referer or Sec-Fetch-Site. Both handlers call
  // `assertInternalBillingRequest`: HMAC over method, path, timestamp and
  // nonce, a five-minute timestamp window, and a single-use nonce.
  '/api/internal/billing/process',
  '/api/internal/billing/reconcile',
  '/api/webhooks/resend',
  // RFC 8058 one-click unsubscribe: mail providers POST cross-site with no
  // session. The HMAC token in `?t=` is the only authority, it can only opt
  // its own learner out of `study_reminders`, and the route is rate-limited.
  '/api/unsubscribe',
]);

export function isStateChangingApiRequest(pathname: string, method: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) return false;

  return !(
    CSRF_EXEMPT_API_PATHS.has(pathname) ||
    CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
