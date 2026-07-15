import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const E2E_CONTROL_TOKEN = 'rinkuzu-e2e-control';
const passwordHashPromise = hash(E2E_PASSWORD, 4);

type SeededUser = {
  email: string;
  id: ObjectId;
};

type DatabaseFixture = {
  admin: SeededUser;
  client: MongoClient;
  db: Db;
  planId: string;
  quizId: ObjectId;
  quizSlug: string;
  regular: SeededUser;
  runId: string;
  target: SeededUser;
};

type SessionPayload = {
  user?: {
    email?: string;
    id?: string;
    role?: string;
  };
};

function requireCiMongoUri(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for critical E2E flows');

  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    databaseName !== 'rinkuzu_ci'
  ) {
    throw new Error('Critical E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci');
  }

  return { databaseName, uri };
}

async function createDatabaseFixture(testInfo: TestInfo): Promise<DatabaseFixture> {
  const { databaseName, uri } = requireCiMongoUri();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const runId = `${testInfo.project.name}-${randomUUID()}`;
    const password = await passwordHashPromise;
    const now = new Date();
    const regular: SeededUser = {
      id: new ObjectId(),
      email: `e2e-regular-${runId}@example.com`,
    };
    const admin: SeededUser = {
      id: new ObjectId(),
      email: `e2e-admin-${runId}@example.com`,
    };
    const target: SeededUser = {
      id: new ObjectId(),
      email: `e2e-target-${runId}@example.com`,
    };
    const quizId = new ObjectId();
    const questionId = new ObjectId();
    const quizSlug = `e2e-critical-${runId}`.toLowerCase();
    const planId = `e2e-plan-${runId}`;

    await db.collection('users').insertMany(
      [
        { ...regular, displayName: 'E2E Regular User', role: 'user' },
        { ...admin, displayName: 'E2E Admin User', role: 'admin' },
        { ...target, displayName: 'E2E Role Target', role: 'user' },
      ].map(({ id, ...user }) => ({
        _id: id,
        ...user,
        _e2eRun: runId,
        createdAt: now,
        emailVerified: now,
        failedLoginAttempts: 0,
        password,
      })),
    );

    await db.collection('quizzes').insertOne({
      _id: quizId,
      _e2eRun: runId,
      author: regular.id,
      createdAt: now,
      description: 'A production E2E quiz fixture',
      isPrivate: false,
      questions: [
        {
          _id: questionId,
          correctIndex: 0,
          options: ['Production is the correct choice', 'This answer is intentionally incorrect'],
          question: 'Which option proves the quiz lifecycle works?',
          type: 'single',
        },
      ],
      slug: quizSlug,
      title: 'Production Critical Quiz',
      updatedAt: now,
    });

    await db
      .collection<{
        _id: string;
        _e2eRun: string;
        createdAt: Date;
        duration: string;
        features: string[];
        isActive: boolean;
        name: string;
        price: number;
        updatedAt: Date;
      }>('plans')
      .insertOne({
        _id: planId,
        _e2eRun: runId,
        createdAt: now,
        duration: 'P1M',
        features: ['Production E2E payment boundary'],
        isActive: true,
        name: 'E2E Premium Monthly',
        price: 49_000,
        updatedAt: now,
      });

    return { admin, client, db, planId, quizId, quizSlug, regular, runId, target };
  } catch (error) {
    await client.close();
    throw error;
  }
}

async function cleanupDatabaseFixture(fixture: DatabaseFixture): Promise<void> {
  const { db, runId } = fixture;
  const userIds = [fixture.regular.id, fixture.admin.id, fixture.target.id];
  const userIdStrings = userIds.map((id) => id.toHexString());
  const emails = [fixture.regular.email, fixture.admin.email, fixture.target.email];

  try {
    await Promise.all([
      db.collection('attempts').deleteMany({
        $or: [{ user: { $in: userIds } }, { quiz: fixture.quizId }],
      }),
      db.collection('quizprogresses').deleteMany({
        $or: [{ userId: { $in: userIds } }, { quiz: fixture.quizId }],
      }),
      db.collection('questionprogresses').deleteMany({ userId: { $in: userIdStrings } }),
      db.collection('userprogresses').deleteMany({ userId: { $in: userIdStrings } }),
      db.collection('auditlogs').deleteMany({
        $or: [{ userId: { $in: userIds } }, { email: { $in: emails } }],
      }),
    ]);
    await db.collection('quizzes').deleteMany({ _e2eRun: runId });
    await db.collection('plans').deleteMany({ _e2eRun: runId });
    await db.collection('users').deleteMany({ _e2eRun: runId });

    const remaining = await Promise.all([
      db.collection('users').countDocuments({ _e2eRun: runId }),
      db.collection('quizzes').countDocuments({ _e2eRun: runId }),
      db.collection('plans').countDocuments({ _e2eRun: runId }),
      db.collection('attempts').countDocuments({ quiz: fixture.quizId }),
      db.collection('userprogresses').countDocuments({ userId: { $in: userIdStrings } }),
    ]);
    if (remaining.some((count) => count !== 0)) {
      throw new Error(`Critical E2E cleanup postcondition failed: ${remaining.join(',')}`);
    }
  } finally {
    await fixture.client.close();
  }
}

async function withDatabaseFixture<T>(
  testInfo: TestInfo,
  run: (fixture: DatabaseFixture) => Promise<T>,
): Promise<T> {
  let fixture: DatabaseFixture | null = null;
  let outcome: { ok: true; value: T } | { error: unknown; ok: false };

  try {
    fixture = await createDatabaseFixture(testInfo);
    outcome = { ok: true, value: await run(fixture) };
  } catch (error) {
    outcome = { error, ok: false };
  }

  if (fixture) {
    try {
      await cleanupDatabaseFixture(fixture);
    } catch (cleanupError) {
      if (!outcome.ok) {
        throw new AggregateError(
          [outcome.error, cleanupError],
          'Critical E2E flow and database cleanup both failed',
        );
      }
      throw cleanupError;
    }
  }

  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

async function login(page: Page, user: SeededUser): Promise<SessionPayload> {
  await page.goto('/en/login?callbackUrl=%2Fdashboard');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard(?:[/?#]|$)/),
    page.getByRole('button', { name: 'Sign In', exact: true }).click(),
  ]);

  const session = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Session endpoint returned ${response.status}`);
    return (await response.json()) as SessionPayload;
  });
  expect(session.user).toMatchObject({
    email: user.email,
    id: user.id.toHexString(),
  });
  return session;
}

test.describe('production critical paths', () => {
  test('persists auth, enforces roles, and logs out @critical-auth', async ({ page }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const session = await login(page, fixture.regular);
      expect(session.user?.role).toBe('user');

      await page.reload();
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);
      await expect(page.getByRole('button', { name: 'Toggle user menu' })).toBeVisible();

      const forbidden = await page.evaluate(async () => {
        const response = await fetch('/api/admin/users');
        return { body: await response.json(), status: response.status };
      });
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toMatchObject({
        error: { code: 'forbidden' },
        success: false,
      });

      await page.goto('/en/admin/users');
      await expect(page).toHaveURL(/\/en\/?$/);

      await page.goto('/en/dashboard');
      await page.getByRole('button', { name: 'Toggle user menu' }).click();
      await Promise.all([
        page.waitForURL(/\/en\/?$/),
        page.getByRole('button', { name: 'Logout', exact: true }).click(),
      ]);
      const loggedOutSession = await page.evaluate(async () =>
        fetch('/api/auth/session', { cache: 'no-store' }).then((response) => response.json()),
      );
      expect(loggedOutSession).not.toHaveProperty('user');
    });
  });

  test('answers, submits, and renders a persisted quiz result @critical-quiz', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      await page.goto(`/en/quiz/${fixture.quizSlug}`);
      await expect(page.getByText('Which option proves the quiz lifecycle works?')).toBeVisible();
      await page.getByText('Production is the correct choice', { exact: true }).click();

      const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
      if (await desktopSubmit.isVisible()) {
        await desktopSubmit.click();
      } else {
        await page.getByRole('button', { name: /complete \(1\/1 answered\)/i }).click();
      }

      await page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`));
      await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
      await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();

      const attempt = await fixture.db.collection('attempts').findOne({
        quiz: fixture.quizId,
        user: fixture.regular.id,
      });
      expect(attempt).toMatchObject({ score: 100, totalQuestions: 1 });
    });
  });

  test('uploads, observes processing, and opens generated learning material @critical-adaptive', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      const origin = new URL(page.url()).origin;
      const subjectName = `E2E Adaptive ${fixture.runId}`;
      let presignedPayload: unknown = null;
      let objectStorageUploadBytes = 0;

      await page.route('**/api/storage/presigned-url', async (route) => {
        presignedPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              expiresIn: 300,
              s3Key: `e2e/${fixture.runId}/material.pdf`,
              uploadUrl: `${origin}/__e2e-object-storage/${fixture.runId}`,
            },
          }),
        });
      });
      await page.route('**/__e2e-object-storage/**', async (route) => {
        objectStorageUploadBytes = route.request().postDataBuffer()?.byteLength ?? 0;
        await route.fulfill({ status: 200, body: '' });
      });

      await page.goto('/en/adaptive/upload');
      await page.getByLabel('Subject Name').fill(subjectName);
      await page.locator('input[type="file"]').setInputFiles({
        name: 'production-e2e.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });

      await page.waitForURL(/\/en\/adaptive(?:[/?#]|$)/);
      expect(presignedPayload).toMatchObject({ purpose: 'adaptive' });
      expect(objectStorageUploadBytes).toBeGreaterThan(0);
      await expect(page.getByText('Processing progress', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(subjectName, { exact: true }).first()).toBeVisible();

      const completion = await request.post('http://127.0.0.1:8000/__e2e/complete', {
        data: { userId: fixture.regular.id.toHexString() },
        headers: { 'x-e2e-control-token': E2E_CONTROL_TOKEN },
      });
      expect(completion.ok()).toBeTruthy();

      const openGeneratedMaterial = page.getByRole('button', {
        name: `Start Learning: ${subjectName}`,
        exact: true,
      });
      await expect(openGeneratedMaterial.first()).toBeVisible();
      await openGeneratedMaterial.first().click();
      await page.waitForURL(
        new RegExp(`/en/adaptive/subject/e2e-session-${fixture.regular.id.toHexString()}$`),
      );
      await expect(page.getByRole('heading', { name: subjectName })).toBeVisible();
      await expect(page.getByText('4', { exact: true }).first()).toBeVisible();
    });
  });

  test('starts PayOS checkout and verifies success and cancellation @critical-subscription', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      let createPaymentPayload: unknown = null;
      let verifyPaymentPayload: unknown = null;

      await page.route('**/api/subscription/create-payment', async (route) => {
        createPaymentPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              amount: 49_000,
              orderCode: 424_242,
              paymentUrl: 'https://pay.payos.vn/web/e2e-production-checkout',
              plan: {
                duration: 'P1M',
                features: ['Production E2E payment boundary'],
                id: fixture.planId,
                name: 'E2E Premium Monthly',
                price: 49_000,
              },
            },
          }),
        });
      });
      await page.route('https://pay.payos.vn/**', async (route) => {
        await route.fulfill({
          contentType: 'text/html',
          body: '<main><h1>PayOS checkout boundary reached</h1></main>',
        });
      });

      await page.goto('/en/subscription');
      await expect(page.getByRole('heading', { name: 'E2E Premium Monthly' })).toBeVisible();
      await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Subscribe', exact: true })
        .click();
      await page.waitForURL('https://pay.payos.vn/web/e2e-production-checkout');
      await expect(
        page.getByRole('heading', { name: 'PayOS checkout boundary reached' }),
      ).toBeVisible();
      expect(createPaymentPayload).toEqual({ planId: fixture.planId });

      await page.route('**/api/subscription/verify', async (route) => {
        verifyPaymentPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              success: true,
              subscription: {
                isActive: true,
                startDate: new Date().toISOString(),
                type: fixture.planId,
              },
            },
          }),
        });
      });
      await page.goto('/en/payment/success?orderCode=424242');
      await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
      expect(verifyPaymentPayload).toEqual({ orderCode: '424242' });

      await page.goto('/en/payment/cancel?orderCode=424242');
      await expect(page.getByRole('heading', { name: 'Payment Cancelled' })).toBeVisible();
      await expect(page.getByText('Order Code: 424242', { exact: true })).toBeVisible();
    });
  });

  test('enforces admin access and performs a persisted role change @critical-admin', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const session = await login(page, fixture.admin);
      expect(session.user?.role).toBe('admin');
      await page.goto('/en/admin/users');
      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();

      const mutation = await page.evaluate(
        async ({ targetUserId }) => {
          const response = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'admin', userId: targetUserId }),
          });
          return { body: await response.json(), status: response.status };
        },
        { targetUserId: fixture.target.id.toHexString() },
      );
      expect(mutation.status).toBe(200);
      expect(mutation.body).toMatchObject({ success: true });

      const persistedTarget = await fixture.db
        .collection('users')
        .findOne({ _id: fixture.target.id });
      expect(persistedTarget?.['role']).toBe('admin');

      const listedTarget = await page.evaluate(
        async ({ email }) => {
          const response = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}`);
          return { body: await response.json(), status: response.status };
        },
        { email: fixture.target.email },
      );
      expect(listedTarget.status).toBe(200);
      expect(listedTarget.body).toMatchObject({
        data: { users: [{ email: fixture.target.email, role: 'admin' }] },
        success: true,
      });
    });
  });
});
