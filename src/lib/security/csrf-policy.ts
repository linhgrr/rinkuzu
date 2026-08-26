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
  '/api/webhooks/resend',
]);

export function isStateChangingApiRequest(pathname: string, method: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) return false;

  return !(
    CSRF_EXEMPT_API_PATHS.has(pathname) ||
    CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
