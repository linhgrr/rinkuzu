import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { DESKTOP_PRIMARY_NAV, MOBILE_TABS_BY_SCOPE } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';
import { buildQuizzesListApiKey } from '@/features/quizzes/lib/quizzes-page-state';

const root = process.cwd();

function deepKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      return deepKeys(child, next);
    }
    return [next];
  });
}

describe('/[locale]/quizzes route contract', () => {
  it('registers the public quizzes route files and constants', () => {
    expect(existsSync(path.join(root, 'src/app/[locale]/(app)/quizzes/page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'src/app/[locale]/(app)/quizzes/layout.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'src/app/[locale]/(app)/quizzes/loading.tsx'))).toBe(true);
    expect(ROUTES.QUIZZES).toBe('/quizzes');
    expect(INDEXABLE_STATIC_PUBLIC_ROUTES).toContain('/quizzes');
    expect(APP_MESSAGE_NAMESPACES).toContain('quizzes');
    expect(DESKTOP_PRIMARY_NAV).toContainEqual(
      expect.objectContaining({ href: ROUTES.QUIZZES, labelKey: 'explore' }),
    );
    expect(MOBILE_TABS_BY_SCOPE.quiz).toContainEqual(
      expect.objectContaining({ href: ROUTES.QUIZZES, labelKey: 'tabQuizzes' }),
    );
  });

  it('keeps en/vi quizzes message key parity', () => {
    const en = JSON.parse(
      readFileSync(path.join(root, 'messages/en/quizzes.json'), 'utf8'),
    ) as unknown;
    const vi = JSON.parse(
      readFileSync(path.join(root, 'messages/vi/quizzes.json'), 'utf8'),
    ) as unknown;

    expect(deepKeys(en).sort()).toEqual(deepKeys(vi).sort());
  });

  it('lists both public and private quizzes by default (all filter)', () => {
    expect(buildQuizzesListApiKey({ query: '', page: 1, visibility: 'all' })).not.toContain(
      'visibility=',
    );
    expect(buildQuizzesListApiKey({ query: '', page: 1, visibility: 'private' })).toContain(
      'visibility=private',
    );
  });
});
