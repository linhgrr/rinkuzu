import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setRequestLocale } = vi.hoisted(() => ({ setRequestLocale: vi.fn() }));

vi.mock('next-intl/server', () => ({ setRequestLocale }));
vi.mock('@/features/quiz/components/PremiumQuizzesPageClient', () => ({
  PremiumQuizzesPageClient: () => <p>premium catalog</p>,
}));

import SignedOutPremiumQuizzesPage, { revalidate } from './page';

describe('/[locale]/signed-out/premium-quizzes twin (RIN-1770)', () => {
  beforeEach(() => setRequestLocale.mockClear());

  it('is cached, not rendered per request', () => {
    expect(revalidate).toBe(600);
    const dir = path.join(process.cwd(), 'src/app/[locale]/(public-cache)/signed-out');
    const source = readFileSync(path.join(dir, 'premium-quizzes/page.tsx'), 'utf8');
    expect(source).not.toMatch(/force-dynamic|next\/headers|searchParams/);
  });

  it('pins the locale and renders the same catalog client as the signed-in route', async () => {
    const element = await SignedOutPremiumQuizzesPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(setRequestLocale).toHaveBeenCalledWith('en');
    expect(renderToStaticMarkup(element)).toContain('premium catalog');
  });
});
