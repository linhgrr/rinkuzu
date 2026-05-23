import { env } from '@/lib/env';
import { publicEnv } from '@/lib/public-env';

export type AdaptiveUserRole = 'admin' | 'user';

export function resolveAdaptiveApiUrl(): string {
  return publicEnv.NEXT_PUBLIC_API_URL;
}

export function resolveAdaptiveProxyTimeoutMs(): number {
  return env.ADAPTIVE_PROXY_TIMEOUT_MS;
}

export function buildAdaptiveServiceHeaders(
  userId: string,
  userRole?: AdaptiveUserRole | null,
): Record<string, string> {
  return {
    'x-user-id': userId,
    ...(userRole ? { 'x-user-role': userRole } : {}),
    'x-service-token': env.INTERNAL_SERVICE_TOKEN,
  };
}
