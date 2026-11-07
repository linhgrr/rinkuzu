import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './support/fixture-identifiers';
import { skipPostSignInStarter } from './support/post-signin';

/**
 * Support centre UX (RIN-1018): the forms validate inline instead of with the
 * browser's tooltip, each page has one h1, and a thread has a back link, author
 * labels, a status badge and a note on what replying to a resolved request does.
 * The ticket is seeded directly, so no support mail is sent.
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const SUBJECT = 'Cannot change my email address';

type Seeded = { email: string; id: ObjectId; ticketId: ObjectId };

function requireCiDatabase(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for support E2E flows');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || databaseName !== 'rinkuzu_ci') {
    throw new Error('Support E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci');
  }
  return { databaseName, uri };
}

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

async function seed(db: Db, runId: string, learner: Seeded): Promise<void> {
  const now = new Date();
  const earlier = new Date(now.getTime() - 60 * 60 * 1000);
  await db.collection('users').insertOne({
    _id: learner.id,
    email: learner.email,
    displayName: 'E2E Support Learner',
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
  await db.collection('supporttickets').insertOne({
    _id: learner.ticketId,
    userId: learner.id,
    subject: SUBJECT,
    category: 'account',
    status: 'resolved',
    priority: 'normal',
    createdBy: 'user',
    assignedAdminId: null,
    lastMessageAt: now,
    resolvedAt: now,
    closedAt: null,
    reopenUntil: null,
    revision: 2,
    createdAt: earlier,
    updatedAt: now,
  });
  await db.collection('supportmessages').insertMany([
    {
      ticketId: learner.ticketId,
      authorUserId: learner.id,
      authorRole: 'user',
      body: 'The settings page keeps my old address.',
      attachmentIds: [],
      clientMessageId: `${runId}-1`,
      createdAt: earlier,
    },
    {
      ticketId: learner.ticketId,
      authorUserId: new ObjectId(),
      authorRole: 'admin',
      body: 'We changed it for you. Please sign in again.',
      attachmentIds: [],
      clientMessageId: `${runId}-2`,
      createdAt: now,
    },
  ]);
}

async function withLearner(testInfo: TestInfo, run: (learner: Seeded) => Promise<void>) {
  const { databaseName, uri } = requireCiDatabase();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);
  const runId = `${testInfo.project.name}-${randomUUID()}`;
  const learner: Seeded = {
    id: new ObjectId(),
    email: createE2EUserEmail('regular', runId),
    ticketId: new ObjectId(),
  };

  try {
    await seed(db, runId, learner);
    await run(learner);
  } finally {
    try {
      await Promise.all([
        db.collection('supportmessages').deleteMany({ ticketId: learner.ticketId }),
        db.collection('supporttickets').deleteMany({ userId: learner.id }),
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

async function login(page: Page, learner: Seeded): Promise<void> {
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
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('support centre', () => {
  test('validates inline, lists the request with a badge and explains a resolved thread @support-centre', async ({
    page,
  }, testInfo) => {
    test.slow();
    await withLearner(testInfo, async (learner) => {
      await login(page, learner);
      await page.goto('/en/support');
      const main = page.locator('#app-main-content');

      await expect(main.getByRole('heading', { level: 1 })).toHaveText('Support');
      await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);

      await main.getByRole('button', { name: 'Send request' }).click();
      const subject = main.getByRole('textbox', { name: 'Subject' });
      await expect(subject).toHaveAttribute('aria-invalid', 'true');
      await expect(subject).toHaveAccessibleDescription(
        'Enter a subject of at least 4 characters.',
      );
      await expect(subject).toBeFocused();
      await expect(main.getByRole('textbox', { name: 'Message' })).toHaveAccessibleDescription(
        'Write your message.',
      );
      await expect(main.getByRole('button', { name: 'Add images' })).toBeVisible();

      const request = main.getByRole('link', { name: new RegExp(SUBJECT, 'u') });
      await expect(request.getByText('Resolved')).toBeVisible();
      await request.click();

      await expect(page).toHaveURL(new RegExp(`/en/support/${learner.ticketId.toHexString()}$`));
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(SUBJECT);
      const history = main.getByRole('list', { name: 'Conversation history' });
      await expect(history.getByRole('listitem').first()).toContainText('You');
      await expect(history.getByRole('listitem').last()).toContainText('Rinkuzu Support');
      await expect(
        main.getByText('This request is resolved. Replying will reopen it.'),
      ).toBeVisible();

      await main.getByRole('button', { name: 'Send reply' }).click();
      await expect(main.getByRole('textbox', { name: 'Reply' })).toHaveAccessibleDescription(
        'Write your reply.',
      );

      await page.setViewportSize({ width: 375, height: 812 });
      await page.reload();
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(SUBJECT);
      await expectNoHorizontalOverflow(page);

      const back = main.getByRole('link', { name: 'Back to requests' });
      await back.focus();
      await expect(back).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/en\/support$/);
      await expect(main.getByRole('heading', { level: 1 })).toHaveText('Support');
      await expectNoHorizontalOverflow(page);

      // The same pages in Vietnamese show Vietnamese UI copy, including the picker and errors.
      await page.goto('/vi/support');
      await expect(main.getByRole('heading', { level: 1 })).toHaveText('Hỗ trợ');
      await expect(main.getByRole('button', { name: 'Thêm ảnh' })).toBeVisible();
      await main.getByRole('button', { name: 'Gửi yêu cầu' }).click();
      await expect(main.getByRole('textbox', { name: 'Tiêu đề' })).toHaveAccessibleDescription(
        'Nhập tiêu đề từ 4 ký tự trở lên.',
      );
      await page.goto(`/vi/support/${learner.ticketId.toHexString()}`);
      await expect(main.getByRole('link', { name: 'Quay lại danh sách yêu cầu' })).toBeVisible();
      const viHistory = main.getByRole('list', { name: 'Lịch sử trao đổi' });
      await expect(viHistory.getByRole('listitem').first()).toContainText('Bạn');
      await expect(viHistory.getByRole('listitem').last()).toContainText('Hỗ trợ Rinkuzu');
      await expect(main.getByText('Đã xử lý', { exact: true })).toBeVisible();
    });
  });
});
