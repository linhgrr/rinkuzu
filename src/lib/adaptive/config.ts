import { env } from '@/lib/env';
import { publicEnv } from '@/lib/public-env';
import type { UserRole } from '@/types/next-auth';

// Canonical first-party API root. Internal routes are deliberately unversioned:
// a contract change cuts every caller over atomically instead of keeping
// multiple runtime generations alive.
const ADAPTIVE_API_BASE_PATH = '/api';

function resolveAdaptiveApiUrl(): string {
  return publicEnv.NEXT_PUBLIC_API_URL;
}

// Infra endpoints (health/ready/live/info) share the same canonical /api root.
const ADAPTIVE_API_INFRA_BASE_PATH = '/api';

/**
 * Build a full upstream URL for the adaptive service.
 * @param path API-relative path beginning with "/", e.g. "/history/subjects".
 */
export function buildAdaptiveUrl(path: string): string {
  return new URL(`${ADAPTIVE_API_BASE_PATH}${path}`, resolveAdaptiveApiUrl()).toString();
}

/**
 * Build a full upstream URL for an infra endpoint.
 * @param path infra path beginning with "/", e.g. "/ready".
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
