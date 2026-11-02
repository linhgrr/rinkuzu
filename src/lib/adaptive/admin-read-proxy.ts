import { proxyAdaptiveRequest, type ProxyAuthContext } from '@/lib/adaptive/proxy';
import { sanitizedGetRequest } from '@/lib/adaptive/sanitized-request';

/**
 * Proxies an admin read to the adaptive API with only the already validated
 * query params, and marks the response -- errors included -- private and
 * uncacheable, since admin aggregates must never land in a shared cache.
 */
export async function proxyAdminAdaptiveRead(
  req: Request,
  params: Parameters<typeof sanitizedGetRequest>[1],
  targetPath: string,
  auth: ProxyAuthContext,
): Promise<Response> {
  const response = await proxyAdaptiveRequest(sanitizedGetRequest(req, params), targetPath, auth);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
