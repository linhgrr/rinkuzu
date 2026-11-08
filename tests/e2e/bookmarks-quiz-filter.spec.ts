import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './support/fixture-identifiers';
import { skipPostSignInStarter } from './support/post-signin';

/**
 * /bookmarks quiz filter and "Open quiz" link (RIN-1208, API from RIN-1199).
 *
 * Seeds one learner with 12 bookmarks from two quizzes, filters by the smaller
 * quiz, removes its bookmarks one by one and expects the list to fall back to
 * "All quizzes" once the quiz has none left.
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const BIOLOGY = { slug: 'e2e-biology-basics', title: 'E2E Biology basics' };
const HISTORY = { slug: 'e2e-world-history', title: 'E2E World history' };

type SeededUser = { email: string; id: ObjectId };

function requireCiDatabase(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for bookmarks E2E flows');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || databaseName !== 'rinkuzu_ci') {
    throw new Error(
      'Bookmarks E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci',
    );
  }
  return { databaseName, uri };
}

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

function bookmarkDocs(learner: SeededUser, quiz: typeof BIOLOGY, count: number, start: Date) {
  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(start.getTime() - index * 60_000);
    return {
      userId: learner.id.toString(),
      userEmail: learner.email,
      quiz,
      question: {
        text: `${quiz.title} sample question ${index + 1}`,
        options: ['First option', 'Second option', 'Third option'],
        type: 'single',
        correctIndex: 0,
      },
      questionIndex: index,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

async function withBookmarkedLearner(
  testInfo: TestInfo,
  run: (learner: SeededUser) => Promise<void>,
) {
  const { databaseName, uri } = requireCiDatabase();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);
  const runId = `${testInfo.project.name}-${randomUUID()}`;
  const learner = { id: new ObjectId(), email: createE2EUserEmail('regular', runId) };

  try {
    const now = new Date();
    await db.collection('users').insertOne({
      _id: learner.id,
      email: learner.email,
      displayName: 'E2E Bookmarks Learner',
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
    await db
      .collection('bookmarks')
      .insertMany([
        ...bookmarkDocs(learner, BIOLOGY, 8, now),
        ...bookmarkDocs(learner, HISTORY, 4, new Date(now.getTime() - 3_600_000)),
      ]);
    await run(learner);
  } finally {
    try {
      await Promise.all([
        db.collection('bookmarks').deleteMany({ userId: learner.id.toString() }),
        db.collection('auditlogs').deleteMany({
          $or: [{ userId: learner.id }, { email: learner.email }],
        }),
        db
          .collection('auth_rate_limits')
          .deleteMany({ key: credentialsRateLimitKey(learner.email) }),
      ]);
      await db.collection('users').deleteMany({ _e2eRun: runId });
    } finally {
      await client.close();
    }
  }
}

async function login(page: Page, user: SeededUser): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
  });
  await page.goto('/en/login?callbackUrl=%2Fdashboard');
  await skipPostSignInStarter(page);
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard(?:[/?#]|$)/),
    page.getByRole('button', { name: 'Sign In', exact: true }).click(),
  ]);
}

/** The email-preferences prompt can cover the list on a fresh account. */
async function dismissEmailPrompt(page: Page): Promise<void> {
  const later = page.getByRole('button', { name: 'Maybe later' });
  if (await later.isVisible().catch(() => false)) await later.click();
}

test.describe('bookmarks quiz filter', () => {
  test('filters by quiz, links back to it and falls back to All when it empties', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await withBookmarkedLearner(testInfo, async (learner) => {
      await login(page, learner);
      await page.goto('/en/bookmarks');

      const quizSelect = page.getByLabel('Quiz', { exact: true });
      await expect(quizSelect).toBeEnabled();
      await dismissEmailPrompt(page);
      await expect(page.getByText('12 questions', { exact: true })).toBeVisible();
      await expect(quizSelect.locator('option')).toHaveText([
        'All quizzes (12)',
        `${BIOLOGY.title} (8)`,
        `${HISTORY.title} (4)`,
      ]);

      await quizSelect.selectOption(HISTORY.slug);
      await expect(page.getByText('4 questions', { exact: true })).toBeVisible();
      const openQuiz = page.getByRole('link', { name: `Open quiz: ${HISTORY.title}` });
      await expect(openQuiz).toHaveCount(4);
      await expect(openQuiz.first()).toHaveAttribute('href', `/en/quiz/${HISTORY.slug}`);
      await expect(page.getByRole('link', { name: `Open quiz: ${BIOLOGY.title}` })).toHaveCount(0);

      for (let remaining = 4; remaining > 0; remaining -= 1) {
        await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
        await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
        const left = remaining - 1;
        if (left > 0) {
          const label = left === 1 ? '1 question' : `${left} questions`;
          await expect(page.getByText(label, { exact: true })).toBeVisible();
        }
      }

      await expect(quizSelect).toHaveValue('');
      await expect(page.getByText('8 questions', { exact: true })).toBeVisible();
      await expect(quizSelect.locator('option')).toHaveText([
        'All quizzes (8)',
        `${BIOLOGY.title} (8)`,
      ]);
    });
  });
});
