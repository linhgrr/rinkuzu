import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import enCommon from '../../messages/en/common.json';
import enCreate from '../../messages/en/create.json';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-992: /create "Your drafts" with a long draft title, signed in.
 *
 * A long title was not truncated, so the row grew wider than the list and the
 * status button and the trash icon were clipped or pushed off screen.
 */

// 120 characters, with one unbroken run so word wrapping alone cannot save the row.
const LONG_TITLE = `Biology chapter twelve cellular respiration review ${'X'.repeat(69)}`;

function transportDraft(id: string, status: 'failed' | 'processing') {
  return {
    draft_id: id,
    title: LONG_TITLE,
    description: null,
    category_id: null,
    prompt: null,
    source_type: 'pdf',
    submit_to_premium: false,
    revision: 1,
    question_count: 0,
    pdf: {
      s3_key: `e2e/${id}.pdf`,
      file_name: 'chapter-12.pdf',
      file_size: 1024,
      page_count: 1,
      file_hash: null,
      retained_for_premium: false,
    },
    status,
    progress: { processed: 0, total: 1, percent: 0 },
    questions: [],
    error: null,
    error_code: null,
    submitted_quiz_id: null,
    created_at: '2026-11-06T08:00:00.000Z',
    updated_at: '2026-11-06T08:00:00.000Z',
    expires_at: null,
  };
}

/** The drafts API is a proxy to the FastAPI service; the list is mocked so the titles are known. */
async function mockDrafts(page: Page) {
  let drafts = [transportDraft('e2e-failed', 'failed'), transportDraft('e2e-busy', 'processing')];
  const ok = (route: Route, data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  await page.route('**/api/quiz-drafts', (route) =>
    route.request().method() === 'GET' ? ok(route, { drafts }) : route.fallback(),
  );
  await page.route('**/api/quiz-drafts/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    if (route.request().method() === 'DELETE') {
      drafts = drafts.filter((draft) => draft.draft_id !== id);
      return ok(route, { deleted: true });
    }
    const draft = drafts.find((item) => item.draft_id === id);
    return draft ? ok(route, { draft }) : route.fallback();
  });
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('element has no layout box');
  return rect;
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 375, height: 800 },
];

test.describe('create hub drafts list (RIN-992)', () => {
  test('a 120-character title stays inside its row and keeps Continue and Delete reachable', async ({
    page,
  }, testInfo) => {
    expect(LONG_TITLE).toHaveLength(120);
    await page.setViewportSize({ width: 1440, height: 900 });
    await withAccounts(testInfo, async ({ regular }) => {
      await mockDrafts(page);
      await login(page, regular);

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        // Reload after resizing so the layout is the one a device of this width gets.
        await page.goto('/en/create');

        const list = page.getByTestId('quiz-drafts-list');
        const titles = list.getByRole('heading', { level: 3, name: LONG_TITLE });
        await expect(titles).toHaveCount(2);
        await expect(titles.first()).toHaveAttribute('title', LONG_TITLE);

        const listBox = await box(list);
        for (const row of await list.locator(':scope > *').all()) {
          const rowBox = await box(row);
          expect(
            rowBox.x + rowBox.width,
            `row fits the list at ${viewport.width}`,
          ).toBeLessThanOrEqual(listBox.x + listBox.width + 0.5);
          const deleteButton = row.getByRole('button', {
            name: enCreate.deleteDraftNamed.replace('{title}', LONG_TITLE),
          });
          await deleteButton.scrollIntoViewIfNeeded();
          await expect(deleteButton).toBeInViewport({ ratio: 1 });
          const deleteBox = await box(deleteButton);
          expect(deleteBox.x + deleteBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
        }

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `page overflow at ${viewport.width}`).toBeLessThanOrEqual(0);

        // The failed draft offers Continue; the processing one shows its disabled status.
        const failedRow = list.locator(':scope > *').first();
        const continueButton = failedRow.getByRole('button', {
          name: enCreate.continueEditing,
          exact: true,
        });
        await expect(continueButton).toBeEnabled();
        await expect(continueButton).toBeInViewport({ ratio: 1 });
        await expect(
          list
            .locator(':scope > *')
            .nth(1)
            .getByRole('button', { name: enCreate.processingDraft, exact: true }),
        ).toBeDisabled();

        // Keyboard: Continue, then Tab lands on Delete.
        await continueButton.focus();
        await expect(continueButton).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
          failedRow.getByRole('button', {
            name: enCreate.deleteDraftNamed.replace('{title}', LONG_TITLE),
          }),
        ).toBeFocused();
      }

      // The delete confirm still opens from the keyboard and removes the row.
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog').filter({ hasText: enCreate.deleteDraftTitle });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: enCommon.remove, exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByTestId('quiz-drafts-list').getByRole('heading', { level: 3, name: LONG_TITLE }),
      ).toHaveCount(1);
    });
  });
});
