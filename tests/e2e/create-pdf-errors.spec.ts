import { strToU8, zipSync } from 'fflate';
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

/** A one-paragraph .docx with enough fake text for the browser extraction (RIN-1787). */
function fakeWordDocument(): Buffer {
  const text = 'Fake e2e notes about the cell and its organelles. '.repeat(8);
  const document =
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  return Buffer.from(zipSync({ 'word/document.xml': strToU8(document) }, { level: 1 }));
}

/** A one-slide .pptx with enough fake text for the browser extraction (RIN-1787). */
function fakeSlideDeck(): Buffer {
  const text = 'Fake e2e slide about mitochondria and the cell. '.repeat(8);
  const slide =
    '<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>' +
    `<p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  return Buffer.from(zipSync({ 'ppt/slides/slide1.xml': strToU8(slide) }, { level: 1 }));
}

/** What `POST /api/quiz-drafts/text` returns for a created text draft (fake, mapped by the page). */
function fakeTextDraft(sourceFileType: 'docx' | 'pptx') {
  return {
    draft_id: 'e2e-draft-1',
    title: 'Fake draft',
    description: '',
    category_id: null,
    prompt: null,
    source_type: 'text',
    source_file_type: sourceFileType,
    submit_to_premium: false,
    revision: 1,
    question_count: 0,
    questions_ready: 0,
    pdf: {
      s3_key: '',
      file_name: '',
      file_size: 0,
      page_count: 0,
      file_hash: null,
      retained_for_premium: false,
    },
    status: 'queued',
    progress: { processed: 0, total: 1, percent: 0 },
    questions: [],
    error: null,
    submitted_quiz_id: null,
    created_at: '2026-11-16T00:00:00Z',
    updated_at: '2026-11-16T00:00:00Z',
    expires_at: '2026-11-23T00:00:00Z',
  };
}

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

  // RIN-1732: one error place, an explained submit, a real Cancel link, 44px controls.
  for (const width of [1440, 1280]) {
    test(`at ${width}px the form has one error place, explains submit, and cancels to the hub (RIN-1732)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 720 });
      await withAccounts(testInfo, async ({ regular }) => {
        await login(page, regular);
        const input = await openReadyDropzone(page);
        const form = page.locator('main form');

        // Submit is not silently disabled: it says what is missing.
        const submit = page.getByRole('button', { name: enCreate.createQuiz, exact: true });
        await expect(submit).toBeEnabled();
        await submit.click();
        await expect(
          page.getByRole('alert').filter({ hasText: enCreate.titleRequired }),
        ).toBeVisible();

        // A bad file reports inside the card, above the dropzone, and takes focus.
        await input.setInputFiles({
          name: 'notes.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('plain text notes'),
        });
        const fileAlert = form.getByRole('alert').filter({ hasText: enCreate.pdfWrongType });
        await expect(fileAlert).toBeVisible();
        await expect(fileAlert).toBeFocused();
        await expect(fileAlert).toBeInViewport();
        // The stale submit message is cleared: exactly one error place.
        await expect(form.getByRole('alert')).toHaveCount(1);

        await input.setInputFiles({
          name: 'chapter-1.pdf',
          mimeType: 'application/pdf',
          buffer: await singlePagePdf(),
        });
        await expect(page.getByRole('button', { name: enCreate.showPDFPreview })).toBeVisible();

        expect(await page.locator('a button, button a').count()).toBe(0);
        const controls = form.locator('button, a[href]:not(p a)');
        const heights = await controls.evaluateAll((nodes) =>
          nodes
            .filter((node) => node.getClientRects().length > 0)
            .map((node) => ({
              label: (node.textContent ?? '').trim() || node.getAttribute('aria-label') || '?',
              height: Math.round(node.getBoundingClientRect().height),
            })),
        );
        expect(heights.filter((control) => control.height < 44)).toEqual([]);

        await form.getByRole('link', { name: /^Cancel$/ }).click();
        await expect(page).toHaveURL(/\/en\/create$/);
      });
    });
  }

  test('at 375px a non-PDF file keeps its message under the dropzone, not in a toast (RIN-1082)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      const input = await openReadyDropzone(page);
      await expect(page).toHaveURL(/\/en\/create\/pdf\/mobile/);

      await input.setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('plain text notes'),
      });
      const alert = page.getByRole('alert').filter({ hasText: enCreate.pdfWrongType });
      await expect(alert).toBeVisible();
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
      await expect(alert).toBeInViewport();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await input.setInputFiles({
        name: 'chapter-1.pdf',
        mimeType: 'application/pdf',
        buffer: await singlePagePdf(),
      });
      await expect(
        page.getByRole('button', { name: enCreate.createQuiz, exact: true }),
      ).toBeVisible();
      await expect(alert).toHaveCount(0);
    });
  });

  test('at 375px a failed submit shows its error next to the button, in view and focused', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      // A plain outage, not an entitlement error: quota_exceeded / premium_required
      // deliberately open the upgrade modal instead of the inline alert (RIN-1087).
      await page.route('**/api/storage/presigned-url', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'service_unavailable', message: 'Service unavailable' },
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
      await expect(alert).toHaveText(enCreate.serviceTemporarilyUnavailable);
      await expect(alert).toBeFocused();
      await expect(alert).toBeInViewport();
      await expect(submit).toBeInViewport();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
  // RIN-1787: Word and PowerPoint are read in the browser and sent as a text draft; the file
  // is never uploaded. The text route is answered with a fake draft (no generation in e2e).
  for (const { label, width, surface, file } of [
    {
      label: '.docx at 1440px',
      width: 1440,
      surface: 'create_pdf',
      file: {
        name: 'Chapter 1 notes.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        type: 'docx',
      },
    },
    {
      label: '.pptx at 375px',
      width: 375,
      surface: 'create_pdf_mobile',
      file: {
        name: 'Week 3 slides.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        type: 'pptx',
      },
    },
  ] as const) {
    test(`a ${label} is read in the browser and sent as a text draft, nothing uploaded (RIN-1787)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await withAccounts(testInfo, async ({ regular }) => {
        await login(page, regular);
        let textBody = '';
        const otherDraftRequests: string[] = [];
        await page.route('**/api/quiz-drafts/text', async (route) => {
          textBody = route.request().postData() ?? '';
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { draft: fakeTextDraft(file.type) } }),
          });
        });
        page.on('request', (request) => {
          const url = new URL(request.url());
          if (
            request.method() === 'POST' &&
            /\/api\/(storage|quiz-drafts)(\/|$)/.test(url.pathname) &&
            !url.pathname.endsWith('/text')
          ) {
            otherDraftRequests.push(url.pathname);
          }
        });
        const input = await openReadyDropzone(page);

        await input.setInputFiles({
          name: file.name,
          mimeType: file.mimeType,
          buffer: file.type === 'docx' ? fakeWordDocument() : fakeSlideDeck(),
        });
        const title = page.getByLabel(enCreate.quizTitle);
        await expect(title).toHaveValue(file.name.replace(/\.(docx|pptx)$/, ''));
        // No PDF preview for a Word or PowerPoint file; the page does not overflow at 375px.
        await expect(page.getByRole('button', { name: enCreate.showPDFPreview })).toHaveCount(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        await page.getByRole('button', { name: enCreate.createQuiz, exact: true }).click();
        await expect(page).toHaveURL(/\/en\/create$/);

        expect(JSON.parse(textBody)).toMatchObject({
          title: file.name.replace(/\.(docx|pptx)$/, ''),
          source_file_type: file.type,
          upload_surface: surface,
          submit_to_premium: false,
        });
        expect(JSON.parse(textBody).text).toContain('Fake e2e');
        expect(otherDraftRequests).toEqual([]);
      });
    });
  }

  test('a legacy .ppt gets its own message and no request is made (RIN-1787)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withAccounts(testInfo, async ({ regular }) => {
      await login(page, regular);
      let draftRequests = 0;
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes('/api/quiz-drafts')) {
          draftRequests += 1;
        }
      });
      const input = await openReadyDropzone(page);

      await input.setInputFiles({
        name: 'old-lecture.ppt',
        mimeType: 'application/vnd.ms-powerpoint',
        buffer: Buffer.from('fake legacy powerpoint'),
      });

      await expect(
        page.getByRole('alert').filter({ hasText: enCreate.officeLegacyFormat }),
      ).toBeVisible();
      expect(draftRequests).toBe(0);
    });
  });
});
