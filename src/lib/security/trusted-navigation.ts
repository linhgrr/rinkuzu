const PAYOS_CHECKOUT_ORIGINS = new Set(['https://pay.payos.vn', 'https://next.pay.payos.vn']);

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isTrustedPayosCheckoutUrl(rawUrl: string): boolean {
  const parsedUrl = parseUrl(rawUrl);

  return (
    parsedUrl !== null &&
    parsedUrl.protocol === 'https:' &&
    PAYOS_CHECKOUT_ORIGINS.has(parsedUrl.origin)
  );
}

export function assertTrustedPayosCheckoutUrl(rawUrl: string): string {
  if (!isTrustedPayosCheckoutUrl(rawUrl)) {
    throw new Error('Received an invalid payment redirect URL');
  }

  return rawUrl;
}

export function openInNewTabSafely(url: string): void {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (newWindow) {
    newWindow.opener = null;
  }
}
