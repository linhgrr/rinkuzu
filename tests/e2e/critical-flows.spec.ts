import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const E2E_CONTROL_TOKEN = 'rinkuzu-e2e-control';
const E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS = [
  'auth:credentials_ip:127.0.0.1',
  'auth:credentials_ip:::1',
  'auth:credentials_ip:unknown',
] as const;
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

function credentialsRateLimitKeys(emails: string[]): string[] {
  return [
    ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
    ...emails.map(
      (email) =>
        `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`,
    ),
  ];
}

const ACTIVE_ADMIN_FENCE_ID = 'active-admin';
const ACTIVE_ADMIN_FENCE_COLLECTION = 'adminmutationfences';

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

/**
 * Canonical fence shape required before admin role/status mutations.
 * Insert-once only: never rewrite revision/updatedAt on an existing document.
 * Malformed existing fences fail closed (no silent repair).
 */
function isCanonicalActiveAdminFence(
  doc: {
    _id?: unknown;
    revision?: unknown;
    updatedAt?: unknown;
  } | null,
): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (doc._id !== ACTIVE_ADMIN_FENCE_ID) return false;
  if (typeof doc.revision !== 'number' || !Number.isInteger(doc.revision) || doc.revision < 0) {
    return false;
  }
  return doc.updatedAt instanceof Date && Number.isFinite(doc.updatedAt.getTime());
}

/**
 * Parallel-safe idempotent seed of the shared active-admin fence singleton.
 * Uses $setOnInsert so concurrent fixtures never reset an existing revision.
 * Cleanup must never delete this document.
 */
type ActiveAdminFenceDoc = {
  _id: string;
  revision: number;
  updatedAt: Date;
};

async function ensureCanonicalActiveAdminFence(db: Db, now: Date): Promise<void> {
  const collection = db.collection<ActiveAdminFenceDoc>(ACTIVE_ADMIN_FENCE_COLLECTION);
  await collection.updateOne(
    { _id: ACTIVE_ADMIN_FENCE_ID },
    {
      $setOnInsert: {
        _id: ACTIVE_ADMIN_FENCE_ID,
        revision: 0,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const fence = await collection.findOne({ _id: ACTIVE_ADMIN_FENCE_ID });
  if (!isCanonicalActiveAdminFence(fence)) {
    throw new Error(
      'Critical E2E active-admin fence missing or malformed; refuse to repair or mutate shared singleton',
    );
  }
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

    // Shared singleton fence for admin mutations — insert-once, never cleaned up per-run.
    await ensureCanonicalActiveAdminFence(db, now);

    await db.collection('auth_rate_limits').deleteMany({
      key: { $in: credentialsRateLimitKeys([regular.email, admin.email, target.email]) },
    });

    await db.collection('users').insertMany(
      [
        { ...regular, displayName: 'E2E Regular User', role: 'user' },
        { ...admin, displayName: 'E2E Admin User', role: 'admin' },
        { ...target, displayName: 'E2E Role Target', role: 'user' },
      ].map(({ id, ...user }) => ({
        _id: id,
        ...user,
        // Canonical disable contract — active filters and session checks require exact fields.
        disable: 0,
        authVersion: 0,
        disabledAt: null,
        disabledBy: null,
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
  const authRateLimitKeys = credentialsRateLimitKeys(emails);
  const llmRateLimitKeyPattern = new RegExp(`:(?:${userIdStrings.join('|')})$`);

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
      db.collection('auth_rate_limits').deleteMany({ key: { $in: authRateLimitKeys } }),
      db.collection('llm_rate_limits').deleteMany({ key: llmRateLimitKeyPattern }),
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
      db.collection('auth_rate_limits').countDocuments({ key: { $in: authRateLimitKeys } }),
      db.collection('llm_rate_limits').countDocuments({ key: llmRateLimitKeyPattern }),
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

async function readSession(page: Page): Promise<SessionPayload> {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Session endpoint returned ${response.status}`);
    return (await response.json()) as SessionPayload;
  });
}

async function login(page: Page, user: SeededUser): Promise<SessionPayload> {
  await page.goto('/en/login?callbackUrl=%2Fdashboard');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard(?:[/?#]|$)/),
    page.getByRole('button', { name: 'Sign In', exact: true }).click(),
  ]);

  const session = await readSession(page);
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
      expect(await readSession(page)).toMatchObject({
        user: { email: fixture.regular.email, id: fixture.regular.id.toHexString() },
      });

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
      // The proxy sends non-admin users to localized home; an authenticated
      // home page then canonicalizes to dashboard by design.
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);

      await page.goto('/en/dashboard');
      const desktopUserMenu = page.getByRole('button', { name: 'Toggle user menu' });
      if (await desktopUserMenu.isVisible()) {
        await desktopUserMenu.click();
      } else {
        await page.getByRole('button', { name: 'Open menu' }).click();
      }
      const logoutButton = page.getByRole('button', { name: 'Logout', exact: true });
      await expect(logoutButton).toBeVisible();
      await Promise.all([page.waitForURL(/\/en\/?$/), logoutButton.click()]);
      const loggedOutSession = await page.evaluate(async () =>
        fetch('/api/auth/session', { cache: 'no-store' }).then((response) => response.json()),
      );
      expect(loggedOutSession).toBeNull();
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
              s3Key: `uploads/adaptive_pipeline/${fixture.regular.id.toHexString()}/e2e-${fixture.runId}.pdf`,
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

      await page.waitForURL(/\/en\/adaptive\/?(?:[?#]|$)/);
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

  test('disables target, revokes session via authVersion, filters, restores, and re-logins @critical-admin-disable', async ({
    page,
    browser,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      // Isolated target BrowserContext so admin login on the default page
      // cannot overwrite the target's pre-disable session cookie.
      const targetContextOptions =
        typeof testInfo.project.use.baseURL === 'string' && testInfo.project.use.baseURL.length > 0
          ? { baseURL: testInfo.project.use.baseURL }
          : undefined;
      const targetContext = await browser.newContext(targetContextOptions);
      try {
        const targetPage = await targetContext.newPage();

        // Target establishes a pre-disable session that must be revoked after disable.
        const targetSessionBefore = await login(targetPage, fixture.target);
        expect(targetSessionBefore.user?.id).toBe(fixture.target.id.toHexString());

        // Admin stays on the default Playwright page/context.
        const adminSession = await login(page, fixture.admin);
        expect(adminSession.user?.role).toBe('admin');
        await page.goto('/en/admin/users');
        await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();

        const disableMutation = await page.evaluate(
          async ({ targetUserId }) => {
            const response = await fetch(`/api/admin/users/${targetUserId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ disable: 1 }),
            });
            return { body: await response.json(), status: response.status };
          },
          { targetUserId: fixture.target.id.toHexString() },
        );
        expect(disableMutation.status).toBe(200);
        expect(disableMutation.body).toMatchObject({
          success: true,
          data: { disable: 1, changed: true },
        });

        const disabledDoc = await fixture.db
          .collection('users')
          .findOne({ _id: fixture.target.id });
        expect(disabledDoc?.['disable']).toBe(1);
        expect(disabledDoc?.['authVersion']).toBe(1);
        expect(disabledDoc?.['disabledAt']).toBeTruthy();
        expect(disabledDoc?.['disabledBy']).toBeTruthy();

        // Pre-existing target cookie (old context) is rejected by the Node session endpoint.
        const revokedSession = await targetPage.evaluate(async () => {
          const response = await fetch('/api/auth/session', { cache: 'no-store' });
          return { status: response.status, body: await response.json() };
        });
        expect(revokedSession.status).toBe(200);
        expect(revokedSession.body?.user).toBeFalsy();

        // Disabled filter lists the target.
        const disabledList = await page.evaluate(
          async ({ email }) => {
            const response = await fetch(
              `/api/admin/users?status=disabled&search=${encodeURIComponent(email)}`,
            );
            return { body: await response.json(), status: response.status };
          },
          { email: fixture.target.email },
        );
        expect(disabledList.status).toBe(200);
        expect(disabledList.body).toMatchObject({
          success: true,
          data: {
            users: [{ email: fixture.target.email, disable: 1 }],
          },
        });

        // Restore increments authVersion again.
        const restoreMutation = await page.evaluate(
          async ({ targetUserId }) => {
            const response = await fetch(`/api/admin/users/${targetUserId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ disable: 0 }),
            });
            return { body: await response.json(), status: response.status };
          },
          { targetUserId: fixture.target.id.toHexString() },
        );
        expect(restoreMutation.status).toBe(200);
        expect(restoreMutation.body).toMatchObject({
          success: true,
          data: { disable: 0, changed: true },
        });

        const restoredDoc = await fixture.db
          .collection('users')
          .findOne({ _id: fixture.target.id });
        expect(restoredDoc?.['disable']).toBe(0);
        expect(restoredDoc?.['authVersion']).toBe(2);
        expect(restoredDoc?.['disabledAt']).toBeNull();
        expect(restoredDoc?.['disabledBy']).toBeNull();

        // Old target cookie (pre-disable JWT, same isolated context) stays rejected after restore.
        const stillRevoked = await targetPage.evaluate(async () => {
          const response = await fetch('/api/auth/session', { cache: 'no-store' });
          return { status: response.status, body: await response.json() };
        });
        expect(stillRevoked.body?.user).toBeFalsy();

        // Clear cookies only immediately before the explicitly fresh target login.
        await targetContext.clearCookies();
        const freshSession = await login(targetPage, fixture.target);
        expect(freshSession.user).toMatchObject({
          email: fixture.target.email,
          id: fixture.target.id.toHexString(),
        });

        // Active filter lists the restored target.
        const activeList = await page.evaluate(
          async ({ email }) => {
            const response = await fetch(
              `/api/admin/users?status=active&search=${encodeURIComponent(email)}`,
            );
            return { body: await response.json(), status: response.status };
          },
          { email: fixture.target.email },
        );
        expect(activeList.status).toBe(200);
        expect(activeList.body).toMatchObject({
          success: true,
          data: {
            users: [{ email: fixture.target.email, disable: 0 }],
          },
        });
      } finally {
        await targetContext.close();
      }
    });
  });
});
