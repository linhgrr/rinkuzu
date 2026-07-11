import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

const navigation = createNavigation(routing);

/**
 * Locale-aware navigation (next-intl best practice).
 * Pass locale-unprefixed hrefs only — never `/en/...` or `/vi/...`.
 *
 * | API | Use for |
 * |-----|---------|
 * | `Link`, `useRouter`, `usePathname`, `redirect` | In-app navigation (locale applied for you) |
 * | `getPathname` | Build a final browser URL for a given locale (NextAuth, emails, middleware) |
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = navigation;
