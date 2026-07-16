export function isRscOrPrefetchRequest(request: Request): boolean {
  const url = new URL(request.url);
  const isNextRouterFetch =
    request.headers.get('accept') === '*/*' &&
    request.headers.get('sec-fetch-dest') === 'empty' &&
    request.headers.get('sec-fetch-mode') === 'cors';
  return (
    url.searchParams.has('_rsc') ||
    request.headers.get('rsc') === '1' ||
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.has('next-router-state-tree') ||
    request.headers.get('purpose') === 'prefetch' ||
    isNextRouterFetch
  );
}

export function usesSecureAuthCookie(request: Request): boolean {
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwardedProtocol === 'https' || new URL(request.url).protocol === 'https:';
}
