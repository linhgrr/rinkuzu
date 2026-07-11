import { matchesPrefix } from '@/lib/routing/pathname';

export const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/adaptive/upload',
  '/adaptive/processing',
  '/adaptive/exercise',
  '/adaptive/subject',
  '/adaptive/result',
  '/create',
  '/profile',
  '/review',
  '/subscription',
  '/history',
  '/bookmarks',
  '/my-quizzes',
  '/draft',
  '/edit',
] as const;

export const ADMIN_PREFIX = '/admin';

export type AuthRoutePolicy = 'admin' | 'authenticated' | 'public';

export function getAuthRoutePolicy(pathWithoutLocale: string): AuthRoutePolicy {
  if (matchesPrefix(pathWithoutLocale, ADMIN_PREFIX)) return 'admin';
  if (AUTH_REQUIRED_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'authenticated';
  }
  return 'public';
}
