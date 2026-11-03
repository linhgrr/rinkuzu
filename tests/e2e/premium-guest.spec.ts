import { randomUUID } from 'node:crypto';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test } from '@playwright/test';

/**
 * RIN-747: a guest opening a Premium quiz must see the quiz and a sign-in that
 * returns to it, never a blank page with the server's raw "Unauthorized".
 */

function requireCiMongoUri(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for premium guest E2E');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    databaseName !== 'rinkuzu_ci'
  ) {
    throw new Error(
      'Premium guest E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci',
    );
  }
  return { databaseName, uri };
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

const COPY = {
  vi: { signIn: 'Đăng nhập', signUp: 'Tạo tài khoản miễn phí', count: '2 câu hỏi' },
  en: { signIn: 'Sign in', signUp: 'Create a free account', count: '2 questions' },
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
    const now = new Date();
    submissionId = new ObjectId();
    slug = `e2e-premium-guest-${runId}`;
    const question = (text: string) => ({
      _id: new ObjectId(),
      correctIndex: 0,
      options: ['Right', 'Wrong'],
      question: text,
      type: 'single',
    });
    await db.collection('premiumquizsubmissions').insertOne({
      _id: submissionId,
      _e2eRun: runId,
      sourceQuiz: new ObjectId(),
      author: new ObjectId(),
      version: 1,
      status: 'approved',
      sourceType: 'manual',
      rightsAttested: true,
      snapshot: {
        title,
        slug,
        description,
        questions: [question('First premium question?'), question('Second premium question?')],
      },
      snapshotHash: `e2e-${runId}`,
      questionHashes: [],
      duplicateReport: {
        exactDocumentRewarded: false,
        exactQuiz: false,
        sharedQuestionCount: 0,
        highestSimilarity: 0,
        matches: [],
      },
      reviewStatus: 'completed',
      awardedCredits: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
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
        await expect(page.getByText(copy.count)).toBeVisible();
        await expect(page.getByText(description)).toBeVisible();
        await expect(page.getByText('Unauthorized')).toHaveCount(0);
        const signIn = page.getByRole('link', { name: copy.signIn, exact: true });
        await expect(signIn).toBeVisible();
        await expect(page.getByRole('link', { name: copy.signUp })).toBeVisible();

        await testInfo.attach(`premium-guest-${locale}-${viewport.width}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }

      await page.getByRole('link', { name: copy.signIn, exact: true }).click();
      await expect(page).toHaveURL(
        (url) =>
          url.pathname.endsWith('/login') &&
          url.searchParams.get('callbackUrl') === `/quiz/${slug}`,
      );
    });
  }
});
