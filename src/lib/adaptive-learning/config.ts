const DEFAULT_ADAPTIVE_API_URL = 'http://localhost:8000';
const DEFAULT_ADAPTIVE_PROXY_TIMEOUT_MS = 60_000;

export function resolveAdaptiveApiUrl(): string {
  return process.env['NEXT_PUBLIC_API_URL'] || DEFAULT_ADAPTIVE_API_URL;
}

export function resolveAdaptiveProxyTimeoutMs(
  fallbackMs: number = DEFAULT_ADAPTIVE_PROXY_TIMEOUT_MS,
): number {
  const raw = Number(process.env['ADAPTIVE_PROXY_TIMEOUT_MS']);
  if (!Number.isFinite(raw) || raw <= 0) return fallbackMs;
  return raw;
}

export function buildAdaptiveServiceHeaders(userId: string): Record<string, string> {
  const serviceToken = process.env['INTERNAL_SERVICE_TOKEN'];
  return {
    'x-user-id': userId,
    ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
  };
}
