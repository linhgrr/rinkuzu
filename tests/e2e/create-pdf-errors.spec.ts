import { expect, test, type Page } from '@playwright/test';
import enCreate from '../../messages/en/create.json';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-991: /create/pdf error states on the built app, signed in.
 *
 * A .txt pick used to show the "corrupted PDF" copy, and at 375px a failed
 * submit put its error ~1000px above the Create Quiz button, so the tap looked
 * like it did nothing.
 */

async function singlePagePdf(): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return Buffer.from(await pdf.save());
}

/** The dropzone gets a tab stop only once the upload policy has loaded (after hydration). */
async function openReadyDropzone(page: Page) {
  await page.goto('/en/create/pdf');
  const input = page.locator('input[type="file"]');
  await expect(input.locator('..')).toHaveAttribute('tabindex', '0', { timeout: 30_000 });
  return input;
}

test.describe('create from PDF error states (RIN-991)', () => {
  test('a non-PDF file gets its own message, a corrupted PDF keeps the unreadable one', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      const input = await openReadyDropzone(page);

      await input.setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('plain text notes'),
      });
      // Next.js route announcer is also role="alert", so match the copy.
      await expect(
        page.getByRole('alert').filter({ hasText: enCreate.pdfWrongType }),
      ).toBeVisible();
      await expect(page.getByText(enCreate.pdfUnreadable)).toHaveCount(0);

      await input.setInputFiles({
        name: 'broken.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('this is not really a pdf'),
      });
      await expect(
        page.getByRole('alert').filter({ hasText: enCreate.pdfUnreadable }),
      ).toBeVisible();

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(enCreate.uploadPDFDocument);
    });
  });

  test('at 375px a failed submit shows its error next to the button, in view and focused', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      await page.route('**/api/storage/presigned-url', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'quota_exceeded', message: 'Quota exceeded' },
          }),
        }),
      );
      const input = await openReadyDropzone(page);
      await expect(page).toHaveURL(/\/en\/create\/pdf\/mobile/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(enCreate.uploadPDFDocument);

      await input.setInputFiles({
        name: 'chapter-1.pdf',
        mimeType: 'application/pdf',
        buffer: await singlePagePdf(),
      });
      const submit = page.getByRole('button', { name: enCreate.createQuiz, exact: true });
      await expect(submit).toBeEnabled();
      await submit.click();

      // The submit-step alert is the one that takes focus (tabindex=-1).
      const alert = page.locator('[role="alert"][tabindex="-1"]');
      await expect(alert).toBeVisible();
      await expect(alert).not.toHaveText('');
      await expect(alert).toBeFocused();
      await expect(alert).toBeInViewport();
      await expect(submit).toBeInViewport();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});
