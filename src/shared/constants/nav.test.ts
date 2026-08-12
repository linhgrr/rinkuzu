import { describe, expect, it } from 'vitest';

import { DESKTOP_PRIMARY_NAV } from '@/shared/constants/nav';
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
