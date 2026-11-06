import { withAuthCallback } from '@/lib/routing/auth-callback';
import { getAuthRoutePolicy } from '@/lib/routing/auth-route-policy';
import { ROUTES } from '@/shared/constants/routes';

interface NavSubItem {
  href: string;
  labelKey: string;
  matchPrefix?: string;
  /** Guest-only: the link goes to sign-in and returns to the item afterwards. */
  locked?: boolean;
}

export interface NavEntry {
  id: string;
  labelKey: string;
  icon: string;
  href?: string;
  matchPrefix?: string;
  items?: NavSubItem[];
  requiredRole?: 'admin';
  locked?: boolean;
}

/**
 * Pages that show a learner's own data. A guest has none, so the entry is left
 * out instead of being a link to sign-in (RIN-978).
 */
const GUEST_HIDDEN_PATHS = new Set<string>([
  ROUTES.DASHBOARD,
  '/my-quizzes',
  '/review',
  '/history',
  '/bookmarks',
  '/profile',
  ROUTES.SUBSCRIPTION,
]);

type GuestLink = { href: string; locked?: true };

function toGuestLink(href: string): GuestLink | null {
  if (GUEST_HIDDEN_PATHS.has(href)) return null;
  if (getAuthRoutePolicy(href) === 'public') return { href };
  return { href: withAuthCallback(ROUTES.LOGIN, href), locked: true };
}

/**
 * The navigation a guest gets: personal pages removed, every other sign-in-only
 * page sent through sign-in with a return URL, public pages unchanged.
 */
export function toGuestNav(entries: NavEntry[]): NavEntry[] {
  return entries.flatMap((entry) => {
    const items = entry.items?.flatMap((item) => {
      const link = toGuestLink(item.href);
      return link ? [{ ...item, ...link }] : [];
    });
    if (items !== undefined && items.length === 0) return [];

    const link = entry.href === undefined ? null : toGuestLink(entry.href);
    if (entry.href !== undefined && !link) return [];

    return [{ ...entry, ...link, ...(items !== undefined ? { items } : {}) }];
  });
}
