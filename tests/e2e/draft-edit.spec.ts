import { expect, test } from '@playwright/test';
import viDraft from '../../messages/vi/draft.json';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-993: /vi/draft/<unknown>/edit showed hardcoded English ("Draft not
 * found") under the marketing tab title "AI Quiz Generator from PDF ...".
 * The fake adaptive service answers an unknown draft with 404, which is the
 * not-found path.
 */
test.describe('draft editor not-found (RIN-993)', () => {
  test('an unknown draft shows Vietnamese copy, a page title and the dashboard link on /vi', async ({
    page,
  }, testInfo) => {
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      await page.goto(`/vi/draft/${'a'.repeat(24)}/edit`);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(viDraft.notFound.title);
      await expect(page).toHaveTitle(viDraft.meta.editTitle);
      await expect(page.getByText('Draft not found')).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: viDraft.notFound.backToDashboard }),
      ).toHaveAttribute('href', '/vi/dashboard');
    });
  });
});
