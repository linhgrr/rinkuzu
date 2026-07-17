import { matchesPrefix } from '@/lib/routing/pathname';
import { AUTH_REQUIRED_PATH_PREFIXES } from '@/shared/constants/nav';

const ADMIN_PREFIX = '/admin';

export type AuthRoutePolicy = 'admin' | 'authenticated' | 'public';

export function getAuthRoutePolicy(pathWithoutLocale: string): AuthRoutePolicy {
  if (matchesPrefix(pathWithoutLocale, ADMIN_PREFIX)) return 'admin';
  if (AUTH_REQUIRED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'authenticated';
  }
  return 'public';
}
