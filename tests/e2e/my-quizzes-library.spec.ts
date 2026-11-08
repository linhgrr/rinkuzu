import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { expect, test } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * /my-quizzes asks the server for 24 quizzes at a time, labels the segments with the
 * whole-library counts, appends pages with Load more and searches on the server (RIN-1206).
 */

const PAGED_QUIZ_COUNT = 26;
const UNIQUE_TITLE = 'Thermodynamics review sheet';

test('my quizzes: counts, Load more and server search', async ({ page }, testInfo) => {
  await withAccounts(testInfo, async ({ db, regular }) => {
    const seedTag = `RIN-1206-${randomUUID()}`;
    const now = Date.now();
    const titles = [
      ...Array.from(
        { length: PAGED_QUIZ_COUNT },
        (_, index) => `Library quiz ${String(index + 1).padStart(2, '0')}`,
      ),
      UNIQUE_TITLE,
    ];

    try {
      await db.collection('quizzes').insertMany(
        titles.map((title, index) => {
          const createdAt = new Date(now - index * 60_000);
          return {
            _id: new ObjectId(),
            _e2eSeed: seedTag,
            author: regular.id,
            createdAt,
            description: 'An E2E library fixture',
            questions: [],
            slug: `${seedTag}-${index}`.toLowerCase(),
            title,
            updatedAt: createdAt,
            visibility: 'personal',
          };
        }),
      );

      await login(page, regular);
      await page.goto('/en/my-quizzes');
      const main = page.locator('#app-main-content');
      const cards = main.locator('article');

      await expect(main.getByRole('button', { name: `All (${titles.length})` })).toBeVisible();
      await expect(main.getByRole('button', { name: 'In progress (0)' })).toBeVisible();
      await expect(cards).toHaveCount(24);

      const loadMore = main.getByRole('button', { name: 'Load more' });
      const nextPage = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === '/api/library' &&
          new URL(request.url()).searchParams.get('page') === '2',
      );
      await loadMore.click();
      await nextPage;
      await expect(cards).toHaveCount(titles.length);
      await expect(loadMore).toBeHidden();

      const search = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === '/api/library' &&
          new URL(request.url()).searchParams.get('q') === 'Thermo',
      );
      await main.getByRole('searchbox', { name: 'Search my quizzes' }).fill('Thermo');
      await search;
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText(UNIQUE_TITLE);
      await expect(main.getByRole('button', { name: `All (${titles.length})` })).toBeVisible();

      await main.getByRole('searchbox', { name: 'Search my quizzes' }).press('Escape');
      await expect(cards).toHaveCount(24);
    } finally {
      await db.collection('quizzes').deleteMany({ _e2eSeed: seedTag });
    }
  });
});
