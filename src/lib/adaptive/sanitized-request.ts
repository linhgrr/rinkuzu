type QueryValue = string | number | boolean | undefined;

/**
 * Rebuilds a GET request whose query string holds only the given, already
 * validated params, so nothing the client sent outside the schema reaches the
 * adaptive API. Undefined values are dropped.
 */
export function sanitizedGetRequest(req: Request, params: Record<string, QueryValue>): Request {
  const url = new URL(req.url);
  url.search = '';
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return new Request(url, { method: 'GET', headers: req.headers, signal: req.signal });
}
