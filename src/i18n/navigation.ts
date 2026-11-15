import { createNavigation } from 'next-intl/navigation';
import { publicPathname } from '@/lib/routing/public-cache';
import { routing } from './routing';

const navigation = createNavigation(routing);

/**
 * Locale-aware navigation (next-intl best practice).
 * Pass locale-unprefixed hrefs only — never `/en/...` or `/vi/...`.
 *
 * | API | Use for |
 * |-----|---------|
 * | `Link`, `useRouter`, `usePathname`, `redirect` | In-app navigation (locale applied for you) |
 *
 * For building a final browser URL for a given locale (NextAuth, emails, middleware),
 * use `toBrowserPath` / pure helpers in `@/lib/routing/pathname` instead of re-exporting
 * next-intl `getPathname` here.
 */
export const { Link, redirect, useRouter } = navigation;

/**
 * The locale-less pathname of the URL the visitor is on. In a cached signed-out
 * twin (RIN-1646) the router reports the rewritten route; this maps it back.
 */
export function usePathname(): string {
  return publicPathname(navigation.usePathname());
}
