import { expect, test, type Page, type Route } from '@playwright/test';
import enCreate from '../../messages/en/create.json';
import enGuest from '../../messages/en/guestDraft.json';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-1542: a signed-in learner picks "Paste text" on /create, pastes notes on
 * /create/text and lands in the normal draft review with the new draft processing.
 * The drafts API is a proxy to the FastAPI service, so it is answered in the browser
 * (no generation in e2e); sign-in and the pages are real.
 */

const FAKE_NOTES = 'Fake e2e notes about mitochondria and cell respiration. ';

function transportTextDraft(id: string, title: string) {
  return {
    draft_id: id,
    title,
    description: null,
    category_id: null,
    prompt: null,
    source_type: 'text',
    submit_to_premium: false,
    revision: 1,
    question_count: 0,
    // The API always sends the pdf block; a text draft has every file field null.
    pdf: {
      s3_key: null,
      file_name: null,
      file_size: null,
      page_count: null,
      file_hash: null,
      retained_for_premium: false,
    },
    status: 'processing',
    progress: { processed: 0, total: 1, percent: 0 },
    questions: [],
    error: null,
    error_code: null,
    submitted_quiz_id: null,
    created_at: '2026-11-11T08:00:00.000Z',
    updated_at: '2026-11-11T08:00:00.000Z',
    expires_at: null,
  };
}

interface DraftsMock {
  posted: Array<Record<string, unknown>>;
}

async function mockTextDrafts(page: Page): Promise<DraftsMock> {
  const mock: DraftsMock = { posted: [] };
  const drafts: Array<ReturnType<typeof transportTextDraft>> = [];
  const ok = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  await page.route('**/api/quiz-drafts', (route) =>
    route.request().method() === 'GET' ? ok(route, { drafts }) : route.fallback(),
  );
  await page.route('**/api/quiz-drafts/text', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    mock.posted.push(body);
    const draft = transportTextDraft('e2e-text-draft', String(body['title']));
    drafts.unshift(draft);
    return ok(route, { draft }, 201);
  });
  await page.route('**/api/quiz-drafts/image', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const buffer = route.request().postDataBuffer();
    // Multipart: keep only what the test asserts (the title field, the count and order of the
    // photo parts), never the bytes.
    const body = buffer?.toString('latin1') ?? '';
    const title = /name="title"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? '';
    const files = Array.from(body.matchAll(/name="images"; filename="([^"]+)"/g), (m) => m[1]);
    mock.posted.push({ title, files, contentType: route.request().headers()['content-type'] });
    const draft = transportTextDraft('e2e-photo-draft', title);
    drafts.unshift(draft);
    return ok(route, { draft }, 201);
  });
  return mock;
}

/**
 * Per method card: the button sits at least 16 px below the description (spacing
 * checklist) and, where a card has an illustration, no line of the description runs
 * under it. Empty when all is well.
 */
async function cardSpacingProblems(page: Page, checkArt: boolean): Promise<string[]> {
  return page.getByRole('region', { name: enCreate.chooseMethod }).evaluate(
    (region, withArt) =>
      Array.from(region.querySelectorAll('h2')).flatMap((heading) => {
        const card = heading.parentElement?.parentElement;
        const copy = heading.parentElement?.querySelector('p')?.getBoundingClientRect();
        const button = card?.querySelector('button')?.getBoundingClientRect();
        const art = card?.querySelector('img')?.getBoundingClientRect();
        if (!copy || !button) return [`${heading.textContent}: missing copy or button`];
        const problems: string[] = [];
        if (button.top - copy.bottom < 16) {
          problems.push(`${heading.textContent}: button ${button.top - copy.bottom}px below copy`);
        }
        // The paragraph box is wider than its text: compare the lines the text really fills.
        const lines = (() => {
          const range = document.createRange();
          range.selectNodeContents(heading.parentElement?.querySelector('p') as Node);
          return Array.from(range.getClientRects());
        })();
        const overlaps = (r: DOMRect) =>
          r.width > 0 &&
          lines.some(
            (line) =>
              r.left < line.right &&
              line.left < r.right &&
              r.top < line.bottom &&
              line.top < r.bottom,
          );
        if (withArt && art && overlaps(art)) {
          problems.push(`${heading.textContent}: copy under the art`);
        }
        return problems;
      }),
    checkArt,
  );
}

/** A 64x48 grey JPEG (fake data): decodable in the browser, so photo preparation runs for real. */
const E2E_PHOTO_JPEG_BASE64 =
  '/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAwAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKkAAAAAAAAAAAAAAAAAAAAAAAH/2Q==';

test.describe('signed-in paste text (RIN-1542)', () => {
  test('goes from the Paste text card to a processing draft in the draft review', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withAccounts(testInfo, async ({ regular }) => {
      const mock = await mockTextDrafts(page);
      await login(page, regular);
      await page.goto('/en/create');

      const methods = page.getByRole('region', { name: enCreate.chooseMethod });
      await expect(methods.getByRole('heading', { level: 2 })).toHaveText([
        enCreate.manualMethodTitle,
        enCreate.pdfMethodTitle,
        enCreate.textMethodTitle,
        enCreate.photoMethodTitle,
      ]);
      await methods.getByRole('button', { name: enCreate.pasteText, exact: true }).click();
      // Client-side navigations: no load event, so wait on the URL itself.
      await expect(page).toHaveURL(/\/en\/create\/text$/);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(enCreate.text.title);
      const textbox = page.getByRole('textbox', { name: enGuest.text.label });
      const create = page.getByRole('button', { name: enCreate.text.submit, exact: true });
      await expect
        .poll(() =>
          textbox.evaluate((node) =>
            Object.keys(node).some((key) => key.startsWith('__reactProps$')),
          ),
        )
        .toBe(true);
      await textbox.fill(FAKE_NOTES.repeat(2));
      await expect(create).toBeDisabled();
      const notes = FAKE_NOTES.repeat(6);
      await textbox.fill(notes);
      await create.click();

      await expect(page).toHaveURL(/\/en\/create$/);
      expect(mock.posted).toEqual([
        expect.objectContaining({ title: enCreate.untitledQuiz, text: notes }),
      ]);
      expect(page.url()).not.toContain('Fake');
      const list = page.getByTestId('quiz-drafts-list');
      await expect(
        list.getByRole('heading', { level: 3, name: enCreate.untitledQuiz }),
      ).toBeVisible({ timeout: 20_000 });
      // A processing draft shows its status word, not a disabled button (RIN-1733).
      await expect(list.getByText(enCreate.draftStatus.processing, { exact: true })).toBeVisible();
    });
  });

  test('goes from the photo card to a processing draft with two photos sent in order (RIN-1794)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withAccounts(testInfo, async ({ regular }) => {
      const mock = await mockTextDrafts(page);
      await login(page, regular);
      await page.goto('/en/create');

      await page
        .getByRole('region', { name: enCreate.chooseMethod })
        .getByRole('button', { name: enCreate.choosePhotos, exact: true })
        .click();
      await expect(page).toHaveURL(/\/en\/create\/photo$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(enCreate.photo.title);

      const gallery = page.locator('[data-photo-input="gallery"]');
      await expect
        .poll(() =>
          gallery.evaluate((node) =>
            Object.keys(node).some((key) => key.startsWith('__reactProps$')),
          ),
        )
        .toBe(true);
      await page.getByLabel(enCreate.photo.quizTitle).fill('Fake e2e photo quiz');
      await gallery.setInputFiles(
        ['one.jpg', 'two.jpg'].map((name) => ({
          name,
          mimeType: 'image/jpeg',
          buffer: Buffer.from(E2E_PHOTO_JPEG_BASE64, 'base64'),
        })),
      );
      const create = page.getByRole('button', { name: enCreate.photo.submit, exact: true });
      await expect(create).toBeEnabled();
      await create.click();

      await expect(page).toHaveURL(/\/en\/create$/);
      expect(mock.posted).toEqual([
        expect.objectContaining({
          title: 'Fake e2e photo quiz',
          files: ['page-1.jpg', 'page-2.jpg'],
          contentType: expect.stringContaining('multipart/form-data'),
        }),
      ]);
      expect(page.url()).not.toContain('one.jpg');
      const list = page.getByTestId('quiz-drafts-list');
      await expect(
        list.getByRole('heading', { level: 3, name: 'Fake e2e photo quiz' }),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test('shows the hub as 2 x 2 cards at 1280 and 1440 and stacked at 375, copy clear of art and buttons', async ({
    page,
  }, testInfo) => {
    await withAccounts(testInfo, async ({ regular }) => {
      await mockTextDrafts(page);
      await login(page, regular);
      for (const [width, columns] of [
        [1280, 2],
        [1440, 2],
        [375, 1],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/en/create');
        const cards = page
          .getByRole('region', { name: enCreate.chooseMethod })
          .getByRole('heading', { level: 2 });
        await expect(cards).toHaveCount(4);
        const tops = await cards.evaluateAll((nodes) =>
          nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
        );
        expect(new Set(tops).size).toBe(4 / columns);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        expect(await cardSpacingProblems(page, columns === 2), `card spacing at ${width}`).toEqual(
          [],
        );
      }
    });
  });
});
