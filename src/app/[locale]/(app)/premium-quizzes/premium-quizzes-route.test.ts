import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { DESKTOP_PRIMARY_NAV } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';

describe('/[locale]/premium-quizzes route contract', () => {
  it('is a standalone indexed catalog linked from the sidebar', () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, 'src/app/[locale]/(app)/premium-quizzes/page.tsx'))).toBe(
      true,
    );
    expect(ROUTES.PREMIUM_QUIZZES).toBe('/premium-quizzes');
    expect(INDEXABLE_STATIC_PUBLIC_ROUTES).toContain(ROUTES.PREMIUM_QUIZZES);
    expect(DESKTOP_PRIMARY_NAV).toContainEqual(
      expect.objectContaining({
        id: 'premium',
        href: ROUTES.PREMIUM_QUIZZES,
        labelKey: 'premiumQuizzes',
      }),
    );
  });
});
