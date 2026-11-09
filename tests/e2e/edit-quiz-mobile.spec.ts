import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { expect, test, type Page } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * The edit page must not scroll sideways on a 375px phone (RIN-1322): the share link
 * in the Quiz Link card is one unbreakable word and used to push the page ~91px wide.
 */

const LOCALES = [
  { locale: 'en', copy: 'Copy', heading: 'Quiz Link' },
  { locale: 'vi', copy: 'Sao chép', heading: 'Liên kết quiz' },
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 120));
    return { overflow: root.scrollWidth - width, offenders };
  });
}

test('edit quiz page has no horizontal scroll at 375px in en and vi', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await withAccounts(testInfo, async ({ db, regular }) => {
    const seedTag = `RIN-1322-${randomUUID()}`;
    const quizId = new ObjectId();
    const now = new Date();
    try {
      await db.collection('quizzes').insertOne({
        _id: quizId,
        _e2eSeed: seedTag,
        author: regular.id,
        createdAt: now,
        description: 'An E2E edit page fixture',
        questions: [
          {
            _id: new ObjectId(),
            correctIndex: 0,
            options: ['Mitochondria', 'Ribosome'],
            question: 'Which organelle produces most of the cell energy?',
            type: 'single',
          },
        ],
        slug: `cell-biology-chapter-three-review-${seedTag}`.toLowerCase(),
        title: 'Cell biology chapter three review',
        updatedAt: now,
        visibility: 'public',
      });

      await login(page, regular);
      await page.setViewportSize({ width: 375, height: 812 });
      for (const { locale, copy, heading } of LOCALES) {
        await page.goto(`/${locale}/edit/${quizId.toHexString()}`);
        const main = page.locator('#app-main-content');
        await expect(main.getByText(heading, { exact: true })).toBeVisible({ timeout: 20_000 });

        expect(await horizontalOverflow(page), `${locale} overflow`).toEqual({
          overflow: 0,
          offenders: [],
        });
        const copyButton = main.getByRole('button', { name: copy, exact: true });
        await copyButton.scrollIntoViewIfNeeded();
        await expect(copyButton).toBeInViewport({ ratio: 1 });
      }
    } finally {
      await db.collection('quizzes').deleteMany({ _e2eSeed: seedTag });
    }
  });
});
