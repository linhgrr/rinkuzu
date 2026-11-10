import { matchesPrefix } from '@/lib/routing/pathname';
import { AUTH_REQUIRED_PATH_PREFIXES } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';

const ADMIN_PREFIX = '/admin';
const ADMIN_REQUIRED_PATH_PREFIXES = [ADMIN_PREFIX, ROUTES.ADAPTIVE_PIPELINE_DEBUG] as const;

/**
 * Exact paths that stay public although a sign-in prefix covers them. `/create` shows a
 * signed-out hub that leads to the guest PDF trial (RIN-1473); `/create/pdf` and everything
 * else under `/create` still needs an account.
 */
const PUBLIC_EXACT_PATHS = new Set<string>([ROUTES.CREATE_QUIZ]);

export type AuthRoutePolicy = 'admin' | 'authenticated' | 'public';

export function getAuthRoutePolicy(pathWithoutLocale: string): AuthRoutePolicy {
  if (ADMIN_REQUIRED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'admin';
  }
  if (PUBLIC_EXACT_PATHS.has(pathWithoutLocale)) return 'public';
  if (AUTH_REQUIRED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'authenticated';
  }
  return 'public';
}
