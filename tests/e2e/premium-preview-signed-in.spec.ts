import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PREMIUM_PREVIEW_QUESTION_LIMIT as LIMIT } from '../../src/shared/constants/premium-preview';
import { login, withAccounts } from './support/admin-accounts';
import { requireCiMongoUri, seedPremiumSubmission } from './support/premium-seed';

/**
 * RIN-1758 (spec RIN-1722): a signed-in learner without access to a Premium quiz plays the
 * first LIMIT questions, submits, and lands on the preview result card. Runs on a production
 * build and the CI Mongo, the path a new signup takes at their first Premium quiz.
 */

const TOTAL = LIMIT + 2;
const title = 'E2E Premium Preview Quiz';
const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

interface Fixture {
  db: Db;
  slug: string;
  submissionId: ObjectId;
  quizId: ObjectId;
  userId: ObjectId;
  email: string;
  pageErrors: string[];
}

/** Seeds a Premium quiz and a free learner (optionally with credits), then removes all of it. */
async function withPreviewFixture(
  page: Page,
  testInfo: TestInfo,
  credits: number,
  run: (fixture: Fixture) => Promise<void>,
): Promise<void> {
  const { databaseName, uri } = requireCiMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);
  const pageErrors: string[] = [];
  // The config blocks service workers, so Serwist's window hook reads `registration.waiting` of
  // nothing. That is the harness, not the page under test.
  page.on('pageerror', (error) => {
    if (!/reading 'waiting'/.test(error.message)) pageErrors.push(error.message);
  });
  const runId = `${testInfo.project.name}-${randomUUID()}`.toLowerCase();
  const slug = `e2e-premium-preview-${runId}`;
  const seed = await seedPremiumSubmission(db, {
    runId,
    slug,
    title,
    description: 'A fake Premium quiz used only by the signed-in preview E2E.',
    questionCount: TOTAL,
  });
  try {
    await withAccounts(testInfo, async ({ db: accountsDb, regular }) => {
      try {
        if (credits > 0) {
          const now = new Date();
          await accountsDb
            .collection('creditwallets')
            .insertOne({ user: regular.id, balance: credits, createdAt: now, updatedAt: now });
        }
        await login(page, regular);
        await run({
          db: accountsDb,
          slug,
          submissionId: seed.submissionId,
          quizId: seed.quizId,
          userId: regular.id,
          email: regular.email,
          pageErrors,
        });
      } finally {
        const user = regular.id;
        await Promise.all(
          [
            'creditwallets',
            'creditledgers',
            'premiumquizaccessgrants',
            'premiumplaysessions',
            'attempts',
            'questionprogresses',
            'quizprogresses',
            'userprogresses',
          ].map((name) => accountsDb.collection(name).deleteMany({ user })),
        );
        await accountsDb.collection('premiumquizsubmissions').deleteOne({ _id: seed.submissionId });
      }
    });
  } finally {
    await client.close();
  }
}

/** Opens the quiz, plays the preview (answer A each time) and submits it. */
async function playPreview(page: Page, slug: string): Promise<void> {
  await page.goto(`/en/quiz/${slug}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(
    page.getByText(`Free preview: the first ${LIMIT} of ${TOTAL} questions`),
  ).toBeVisible();
  for (let number = 1; number <= LIMIT; number += 1) {
    await expect(page.getByText(`${number}/${LIMIT}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Premium question ${number}?`)).toBeVisible();
    // The options stay disabled until the page has hydrated.
    await expect(page.getByLabel('Option A', { exact: true })).toBeEnabled();
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/premium-quizzes/sessions/'),
    );
    await page.getByText('Right', { exact: true }).click();
    expect((await saved).ok()).toBe(true);
    if (number < LIMIT) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText('Next', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit Quiz', exact: true }).click();
  await page.waitForURL(new RegExp(`/en/quiz/${slug}/result\\?attemptId=[a-f0-9]{24}`));
}

const resultHeading = (page: Page) =>
  page.getByRole('heading', { name: `You tried ${LIMIT} of ${TOTAL} questions` });
const upgradeLink = (page: Page) =>
  page.getByRole('link', { name: 'Upgrade to Premium', exact: true });

async function expectCleanPage(page: Page, fixture: Fixture): Promise<void> {
  await expect(page.getByText('Unauthorized')).toHaveCount(0);
  await expect(page.getByText('Premium subscription or one credit is required')).toHaveCount(0);
  expect(fixture.pageErrors).toEqual([]);
}

test.describe('signed-in Premium preview (RIN-1758)', () => {
  test('0 credits: plays the preview and gets the upgrade path, not an unlock', async ({
    page,
  }, testInfo) => {
    await withPreviewFixture(page, testInfo, 0, async (fixture) => {
      for (const viewport of [MOBILE, DESKTOP]) {
        await page.setViewportSize(viewport);
        await playPreview(page, fixture.slug);
        await expect(resultHeading(page)).toBeVisible();
        await expect(page.getByText(/Unlock the other 2 to keep this quiz forever/)).toBeVisible();
        const unlock = page.getByRole('button', { name: /Not enough credits/ });
        await expect(unlock).toBeVisible();
        await expect(unlock).toBeDisabled();
        await expect(upgradeLink(page)).toBeVisible();
        await expect(page.getByText('You have 0 credits')).toBeVisible();
        await expectCleanPage(page, fixture);
        await testInfo.attach(`premium-preview-0-credits-${viewport.width}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }
      expect(
        await fixture.db.collection('creditledgers').countDocuments({ user: fixture.userId }),
      ).toBe(0);
    });
  });

  test('1+ credits: unlocks from the result card, spends one credit, plays the full quiz', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(MOBILE);
    await withPreviewFixture(page, testInfo, 3, async (fixture) => {
      await playPreview(page, fixture.slug);
      await expect(resultHeading(page)).toBeVisible();
      await expect(page.getByText('You have 3 credits')).toBeVisible();
      const unlock = page.getByRole('button', { name: /Unlock 2 questions/ });
      await expect(unlock).toBeEnabled();
      await unlock.click();

      await expect(page.getByRole('heading', { name: 'Quiz unlocked' })).toBeVisible();
      await expect(page.getByText(`All ${TOTAL} questions are yours.`)).toBeVisible();
      const wallet = await fixture.db.collection('creditwallets').findOne({ user: fixture.userId });
      expect(wallet?.['balance']).toBe(2);
      expect(
        await fixture.db
          .collection('creditledgers')
          .find({ user: fixture.userId, type: 'quiz_unlock' })
          .toArray(),
      ).toMatchObject([{ amount: -1, balanceAfter: 2 }]);
      expect(
        await fixture.db
          .collection('premiumquizaccessgrants')
          .countDocuments({ user: fixture.userId, quiz: fixture.quizId }),
      ).toBe(1);

      await page.getByRole('link', { name: 'Play the full quiz', exact: true }).click();
      await page.waitForURL(new RegExp(`/en/quiz/${fixture.slug}$`));
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(`1/${TOTAL}`, { exact: true })).toBeVisible();
      await expect(page.getByText('Preview', { exact: true })).toHaveCount(0);
      await expectCleanPage(page, fixture);
    });
  });

  test('the preview attempt is stored and its result survives a reload', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(MOBILE);
    await withPreviewFixture(page, testInfo, 0, async (fixture) => {
      await playPreview(page, fixture.slug);
      await expect(resultHeading(page)).toBeVisible();
      const attempts = await fixture.db
        .collection('attempts')
        .find({ user: fixture.userId, premiumSubmission: fixture.submissionId })
        .toArray();
      expect(attempts).toMatchObject([{ preview: true, totalQuestions: LIMIT, score: 100 }]);

      // The result page reads the attempt back from the server, not from client state.
      await page.reload();
      await expect(resultHeading(page)).toBeVisible();
      await expect(upgradeLink(page)).toBeVisible();
      await expect(page.getByRole('button', { name: /Not enough credits/ })).toBeDisabled();
      await expectCleanPage(page, fixture);
    });
  });
});
