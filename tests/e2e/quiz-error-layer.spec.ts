import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Page } from '@playwright/test';
import viErrors from '../../messages/vi/errors.json';
import viQuiz from '../../messages/vi/quiz.json';
import { createE2EUserEmail } from './support/fixture-identifiers';
import { skipPostSignInStarter } from './support/post-signin';

/**
 * RIN-805: the API error layer (RIN-748/RIN-753) on the real quiz surfaces.
 *
 * Component tests cover the ErrorState mapping; these drive the built app with
 * a real database, so a page that never reaches the layer (a server 404, a
 * guest 401, a missing attempt id) fails here instead of on production.
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const MISSING_SLUG = 'does-not-exist-xyz';
const RAW_SERVER_TEXT = ['Unauthorized', 'Quiz not found', 'Premium quiz not found', 'not_found'];
const ERROR_TITLES = Object.entries(viErrors.api)
  .filter(([key, value]) => key.endsWith('Title') && typeof value === 'string')
  .map(([, value]) => value as string);

function requireCiMongoUri(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for quiz error-layer E2E');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    databaseName !== 'rinkuzu_ci'
  ) {
    throw new Error(
      'Quiz error-layer E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci',
    );
  }
  return { databaseName, uri };
}

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

async function expectNoRawServerText(page: Page): Promise<void> {
  for (const text of RAW_SERVER_TEXT) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
}

async function expectSignInBackTo(page: Page, quizPath: string): Promise<void> {
  // The app header has its own Sign in (RIN-958); this is the Premium card one.
  const signIn = page
    .locator('#app-main-content')
    .getByRole('link', { name: viQuiz.premiumSignInButton, exact: true });
  await expect(signIn).toBeVisible();
  const href = await signIn.getAttribute('href');
  const target = new URL(href ?? '', 'http://localhost');
  expect(target.pathname).toBe('/vi/login');
  expect(target.searchParams.get('callbackUrl')).toBe(quizPath);
}

async function expectPageNotFound(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 2, name: viErrors.api.notFoundTitle }),
  ).toBeVisible();
  await expect(page.getByText(viErrors.api.notFound)).toBeVisible();
  await expect(page.getByRole('link', { name: viErrors.api.actions.goHome })).toBeVisible();
  await expectNoRawServerText(page);
}

test.describe('quiz API error layer (RIN-805)', () => {
  let client: MongoClient;
  let db: Db;
  let runId: string;
  let submissionId: ObjectId;
  let learner: { id: ObjectId; email: string };
  let slug: string;
  const title = 'E2E Premium Error Layer Quiz';

  test.beforeAll(async () => {
    const { databaseName, uri } = requireCiMongoUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(databaseName);
    runId = `${test.info().project.name}-${randomUUID()}`.toLowerCase();
    const now = new Date();
    submissionId = new ObjectId();
    slug = `e2e-premium-error-layer-${runId}`;
    learner = { id: new ObjectId(), email: createE2EUserEmail('regular', runId) };
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
        description: 'A fake Premium quiz used only by the error-layer E2E.',
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
    // A free learner: no subscription, no credits, no grant for this quiz.
    await db.collection('users').insertOne({
      _id: learner.id,
      email: learner.email,
      displayName: 'E2E Error Layer Learner',
      role: 'user',
      _e2eRun: runId,
      authVersion: 0,
      createdAt: now,
      disable: 0,
      disabledAt: null,
      disabledBy: null,
      emailVerified: now,
      failedLoginAttempts: 0,
      password: await hash(E2E_PASSWORD, 4),
    });
  });

  test.afterAll(async () => {
    if (!db) return;
    try {
      await Promise.all([
        db.collection('premiumquizsubmissions').deleteOne({ _id: submissionId }),
        db.collection('auditlogs').deleteMany({
          $or: [{ userId: learner.id }, { email: learner.email }],
        }),
        db
          .collection('auth_rate_limits')
          .deleteMany({ key: credentialsRateLimitKey(learner.email) }),
      ]);
      await db.collection('users').deleteMany({ _e2eRun: runId });
      const remaining = await db.collection('users').countDocuments({ _e2eRun: runId });
      if (remaining !== 0) throw new Error(`Quiz error-layer E2E cleanup left ${remaining} users`);
    } finally {
      await client.close();
    }
  });

  test('a guest on a Premium quiz is asked to sign in and comes back to it', async ({ page }) => {
    await page.goto(`/vi/quiz/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expectSignInBackTo(page, `/quiz/${slug}`);
    await expectNoRawServerText(page);
  });

  test('a guest on Premium flashcards is asked to sign in, not shown Unauthorized', async ({
    page,
  }) => {
    await page.goto(`/vi/quiz/${slug}/flashcards`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    // The prompt returns to the quiz page, which also starts the flashcards.
    await expectSignInBackTo(page, `/quiz/${slug}`);
    await expectNoRawServerText(page);
  });

  test('a learner without credit or subscription sees the unlock card', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
    });
    await page.goto('/en/login?callbackUrl=%2Fdashboard');
    await skipPostSignInStarter(page);
    await page.getByLabel('Email Address').fill(learner.email);
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/en\/dashboard(?:[/?#]|$)/),
      page.getByRole('button', { name: 'Sign In', exact: true }).click(),
    ]);

    await page.goto(`/vi/quiz/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(viQuiz.premiumUnlockDescription)).toBeVisible();
    await expect(page.getByRole('button', { name: viQuiz.premiumUnlockButton })).toBeVisible();
    for (const errorTitle of ERROR_TITLES) {
      await expect(page.getByRole('heading', { name: errorTitle, exact: true })).toHaveCount(0);
    }
    await expectNoRawServerText(page);
  });

  test('an unknown quiz slug shows the page-level not-found state', async ({ page }) => {
    await page.goto(`/vi/quiz/${MISSING_SLUG}`);
    await expectPageNotFound(page);
  });

  test('a result link without an attempt id shows the page-level not-found state', async ({
    page,
  }) => {
    await page.goto(`/vi/quiz/${slug}/result`);
    await expectPageNotFound(page);
  });
});
