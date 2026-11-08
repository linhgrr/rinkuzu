import { describe, expect, it } from 'vitest';

import { DESKTOP_PRIMARY_NAV, MOBILE_TABS_BY_SCOPE } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';

describe('desktop admin navigation', () => {
  it('keeps Pipeline Debug inside the admin-only navigation group', () => {
    const adminGroup = DESKTOP_PRIMARY_NAV.find((group) => group.id === 'admin');

    expect(adminGroup).toMatchObject({ requiredRole: 'admin' });
    expect(adminGroup?.items).toContainEqual({
      href: ROUTES.ADAPTIVE_PIPELINE_DEBUG,
      labelKey: 'pipelineDebug',
    });
  });
});

describe('mobile bottom navigation', () => {
  const scopes = Object.keys(MOBILE_TABS_BY_SCOPE) as Array<keyof typeof MOBILE_TABS_BY_SCOPE>;
  const labelledTabs = (scope: keyof typeof MOBILE_TABS_BY_SCOPE) =>
    MOBILE_TABS_BY_SCOPE[scope]
      .map((tab, position) => ({
        position,
        href: tab.href,
        labelKey: tab.labelKey,
        isCenter: tab.isCenter,
      }))
      .filter((tab) => !tab.isCenter);

  it('keeps every labelled tab in the same position with the same meaning on all routes (RIN-689)', () => {
    const reference = labelledTabs('hub');
    for (const scope of scopes) {
      expect(labelledTabs(scope), `${scope} labelled tabs`).toEqual(reference);
    }
  });

  it('only varies the unlabelled centre action, and keeps it in the centre', () => {
    for (const scope of scopes) {
      const tabs = MOBILE_TABS_BY_SCOPE[scope];
      expect(
        tabs.filter((tab) => tab.isCenter),
        `${scope} centre action`,
      ).toHaveLength(1);
      expect(tabs.findIndex((tab) => tab.isCenter)).toBe(Math.floor(tabs.length / 2));
    }
  });

  it('never points two tabs of one bar at the same page', () => {
    for (const scope of scopes) {
      const hrefs = MOBILE_TABS_BY_SCOPE[scope].map((tab) => tab.href);
      expect(new Set(hrefs).size, `${scope} hrefs`).toBe(hrefs.length);
    }
  });
});
