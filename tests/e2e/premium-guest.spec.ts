import { randomUUID } from 'node:crypto';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test } from '@playwright/test';
import { requireCiMongoUri, seedPremiumSubmission } from './support/premium-seed';

/**
 * RIN-747: a guest opening a Premium quiz must see the quiz and a sign-in that
 * returns to it, never a blank page with the server's raw "Unauthorized".
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

const COPY = {
  vi: {
    signIn: 'Đăng nhập',
    signUp: 'Tạo tài khoản miễn phí',
    count: '2 câu hỏi',
    prompt: 'Đăng nhập để làm thử miễn phí 2 câu đầu',
  },
  en: {
    signIn: 'Sign in',
    signUp: 'Create a free account',
    count: '2 questions',
    prompt: 'Sign in to try the first 2 questions free',
  },
} as const;

test.describe('premium quiz guest state (RIN-747)', () => {
  let client: MongoClient;
  let db: Db;
  let submissionId: ObjectId;
  let slug: string;
  const title = 'E2E Premium Guest Quiz';
  const description = 'A fake Premium quiz used only by the guest E2E.';

  test.beforeAll(async () => {
    const testInfo = test.info();
    const { databaseName, uri } = requireCiMongoUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(databaseName);
    const runId = `${testInfo.project.name}-${randomUUID()}`.toLowerCase();
    slug = `e2e-premium-guest-${runId}`;
    ({ submissionId } = await seedPremiumSubmission(db, {
      runId,
      slug,
      title,
      description,
      questionCount: 2,
    }));
  });

  test.afterAll(async () => {
    if (!db) return;
    await db.collection('premiumquizsubmissions').deleteOne({ _id: submissionId });
    await client.close();
  });

  for (const locale of ['vi', 'en'] as const) {
    test(`a guest sees the quiz and a sign-in that returns to it (${locale})`, async ({
      page,
    }, testInfo) => {
      const copy = COPY[locale];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(`/${locale}/quiz/${slug}`);

        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        await expect(page.getByText(copy.count, { exact: true })).toBeVisible();
        // RIN-1725: the prompt offers the free preview questions.
        await expect(page.getByText(copy.prompt, { exact: true })).toBeVisible();
        await expect(page.getByText(description)).toBeVisible();
        await expect(page.getByText('Unauthorized')).toHaveCount(0);
        // The app header has its own Sign in (RIN-958); this is the quiz card one.
        const main = page.locator('#app-main-content');
        const signIn = main.getByRole('link', { name: copy.signIn, exact: true });
        await expect(signIn).toBeVisible();
        await expect(main.getByRole('link', { name: copy.signUp })).toBeVisible();

        await testInfo.attach(`premium-guest-${locale}-${viewport.width}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }

      await page
        .locator('#app-main-content')
        .getByRole('link', { name: copy.signIn, exact: true })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          url.pathname.endsWith('/login') &&
          url.searchParams.get('callbackUrl') === `/quiz/${slug}`,
      );
    });
  }
});
