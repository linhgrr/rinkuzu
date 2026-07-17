import { env } from '@/lib/env';
import { publicEnv } from '@/lib/public-env';
import type { UserRole } from '@/types/next-auth';

// Single source of truth for the adaptive service API version. Every upstream
// path is joined through buildAdaptiveUrl, so bumping the version is a one-line
// change here. NEXT_PUBLIC_API_URL stays the bare host (no /api).
const ADAPTIVE_API_BASE_PATH = '/api/v1';

function resolveAdaptiveApiUrl(): string {
  return publicEnv.NEXT_PUBLIC_API_URL;
}

// Infra endpoints (health/ready/live/info) live at /api on the backend, NOT
// under the versioned /api/v1 surface — they describe the service itself, not
// the versioned contract.
const ADAPTIVE_API_INFRA_BASE_PATH = '/api';

/**
 * Build a full upstream URL for the adaptive service.
 * @param path version-relative path beginning with "/", e.g. "/history/subjects".
 */
export function buildAdaptiveUrl(path: string): string {
  return new URL(`${ADAPTIVE_API_BASE_PATH}${path}`, resolveAdaptiveApiUrl()).toString();
}

/**
 * Build a full upstream URL for an unversioned infra endpoint.
 * @param path infra path beginning with "/", e.g. "/health".
 */
export function buildAdaptiveInfraUrl(path: string): string {
  return new URL(`${ADAPTIVE_API_INFRA_BASE_PATH}${path}`, resolveAdaptiveApiUrl()).toString();
}

export function resolveAdaptiveProxyTimeoutMs(): number {
  return env.ADAPTIVE_PROXY_TIMEOUT_MS;
}

export function buildAdaptiveServiceHeaders(
  userId?: string,
  userRole?: UserRole | null,
): Record<string, string> {
  return {
    ...(userId ? { 'x-user-id': userId } : {}),
    ...(userRole ? { 'x-user-role': userRole } : {}),
    'x-service-token': env.INTERNAL_SERVICE_TOKEN,
  };
}
