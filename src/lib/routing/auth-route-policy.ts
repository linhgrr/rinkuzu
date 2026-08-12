import { matchesPrefix } from '@/lib/routing/pathname';
import { AUTH_REQUIRED_PATH_PREFIXES } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';

const ADMIN_PREFIX = '/admin';
const ADMIN_REQUIRED_PATH_PREFIXES = [ADMIN_PREFIX, ROUTES.ADAPTIVE_PIPELINE_DEBUG] as const;

export type AuthRoutePolicy = 'admin' | 'authenticated' | 'public';

export function getAuthRoutePolicy(pathWithoutLocale: string): AuthRoutePolicy {
  if (ADMIN_REQUIRED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'admin';
  }
  if (AUTH_REQUIRED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'authenticated';
  }
  return 'public';
}
