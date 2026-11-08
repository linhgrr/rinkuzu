import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { expect, test } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * The owner chooses Private / Public on the quiz edit page (RIN-1275). A new
 * quiz is private (RIN-1271); switching to Public explains what that means and
 * the save sends the new visibility.
 */
test('quiz edit: the owner makes a private quiz public', async ({ page }, testInfo) => {
  await withAccounts(testInfo, async ({ db, regular }) => {
    const seedTag = `RIN-1275-${randomUUID()}`;
    const quizId = new ObjectId();
    const now = new Date();

    try {
      await db.collection('quizzes').insertOne({
        _id: quizId,
        _e2eSeed: seedTag,
        author: regular.id,
        createdAt: now,
        description: 'An E2E visibility fixture',
        questions: [
          {
            _id: new ObjectId(),
            correctIndex: 0,
            options: ['A unit of life', 'A rock'],
            question: 'What is a cell?',
            type: 'single',
          },
        ],
        slug: seedTag.toLowerCase(),
        title: 'Cell biology visibility',
        updatedAt: now,
        visibility: 'personal',
      });

      await login(page, regular);
      await page.goto(`/en/edit/${quizId.toHexString()}`);
      const main = page.locator('#app-main-content');
      const control = main.getByRole('group', { name: 'Who can see this quiz' });

      // The edit page loads the quiz client-side; a cold server can take a while.
      await expect(control.getByRole('button', { name: 'Private' })).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 20_000 },
      );
      await expect(main.getByText('Only you can see this quiz.')).toBeVisible();

      await control.getByRole('button', { name: 'Public' }).click();
      await expect(
        main.getByText('Anyone with the link can see this quiz, and it may appear in search.'),
      ).toBeVisible();

      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname === `/api/quizzes/${quizId.toHexString()}`,
      );
      await main.getByRole('button', { name: 'Save Changes' }).click();
      const response = await saved;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toMatchObject({ visibility: 'public' });
      await expect(main.getByText('Quiz updated successfully!')).toBeVisible();

      const stored = await db
        .collection<{ visibility: string }>('quizzes')
        .findOne({ _id: quizId }, { projection: { visibility: 1 } });
      expect(stored?.visibility).toBe('public');
    } finally {
      await db.collection('quizzes').deleteMany({ _e2eSeed: seedTag });
    }
  });
});
