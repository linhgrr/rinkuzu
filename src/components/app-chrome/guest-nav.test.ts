import { describe, expect, it } from 'vitest';
import { DESKTOP_BOTTOM_NAV, DESKTOP_PRIMARY_NAV } from '@/shared/constants/nav';
import { getAuthRoutePolicy } from '@/lib/routing/auth-route-policy';
import { toGuestNav, type NavEntry } from './guest-nav';

const withIcon = (defs: typeof DESKTOP_PRIMARY_NAV): NavEntry[] =>
  defs.map((def) => ({ ...def, icon: 'icon' }));

function allLinks(entries: NavEntry[]) {
  return entries.flatMap((entry) => [
    ...(entry.href !== undefined ? [{ href: entry.href, locked: entry.locked }] : []),
    ...(entry.items ?? []).map((item) => ({ href: item.href, locked: item.locked })),
  ]);
}

describe('toGuestNav (RIN-978)', () => {
  const primary = toGuestNav(withIcon(DESKTOP_PRIMARY_NAV.filter((d) => !d.requiredRole)));
  const bottom = toGuestNav(withIcon(DESKTOP_BOTTOM_NAV));

  it('drops what only an account has: home, my quizzes, review, history, bookmarks, settings', () => {
    const labels = [...primary, ...bottom].flatMap((entry) => [
      entry.labelKey,
      ...(entry.items ?? []).map((item) => item.labelKey),
    ]);
    for (const hidden of ['home', 'myQuizzes', 'review', 'history', 'bookmarks', 'settings']) {
      expect(labels).not.toContain(hidden);
    }
    expect(labels).toEqual(
      expect.arrayContaining(['createQuiz', 'adaptiveLibrary', 'premiumQuizzes', 'quizzes']),
    );
  });

  it('sends every remaining sign-in-only entry to login with a return URL', () => {
    const links = allLinks([...primary, ...bottom]);
    expect(links).toContainEqual({ href: '/login?callbackUrl=%2Fcreate', locked: true });
    expect(links).toContainEqual({
      href: '/login?callbackUrl=%2Fadaptive%2Fupload',
      locked: true,
    });
    expect(links).toContainEqual({ href: '/login?callbackUrl=%2Fsupport', locked: true });
    for (const link of links) {
      if (link.locked) expect(link.href).toMatch(/^\/login\?callbackUrl=/);
      else expect(getAuthRoutePolicy(link.href)).toBe('public');
    }
  });

  it('keeps public entries as they are', () => {
    const links = allLinks(primary);
    expect(links).toContainEqual({ href: '/premium-quizzes', locked: undefined });
    expect(links).toContainEqual({ href: '/quizzes', locked: undefined });
    expect(links).toContainEqual({ href: '/adaptive', locked: undefined });
  });
});
