import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './support/fixture-identifiers';
import { STARTER_QUIZ_ALLOWLIST } from '../../src/services/dashboard/starter-quizzes';
import { skipPostSignInStarter } from './support/post-signin';

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
  planName: string;
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

/**
 * The rate-limit keys a fixture created and is therefore allowed to assert on.
 *
 * Deliberately not the per-IP keys. Those are keyed by the address the browser
 * connects from, which is the same loopback address for every project, so the
 * three projects running this file in parallel all write and delete the same
 * three rows. A fixture that asserts those are gone is asserting about another
 * project's login, and it fails whenever the two interleave — which read as a
 * flake in whichever flow happened to finish second. Identity keys are hashed
 * from seeded emails and belong to exactly one fixture.
 */
function ownedCredentialsRateLimitKeys(emails: string[]): string[] {
  return emails.map(
    (email) =>
      `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`,
  );
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

/**
 * Parallel-safe idempotent seed of the first allowlisted starter quiz (RIN-556).
 * The dashboard resolves the allowlist by slug, a unique key every project in
 * the matrix shares, so this is insert-once like the admin fence above and
 * cleanup must never delete it.
 *
 * Its author is seeded the same way. A quiz whose author has no user document
 * cannot happen in the app, and the admin stats overview refuses one (top
 * creators fail closed), so an orphaned fixture would leave /admin/stats
 * returning 500 for every flow that runs after this one (RIN-425).
 */
const E2E_STARTER_QUIZ = {
  author: new ObjectId('000000000000000000005560'),
  authorEmail: 'e2e-starter-author@example.com',
  question: 'Which option opens the starter quiz?',
  title: 'E2E Starter Quiz',
} as const;

async function ensureStarterQuiz(db: Db, now: Date): Promise<string> {
  const slug = STARTER_QUIZ_ALLOWLIST[0]?.slug;
  if (!slug) throw new Error('Starter quiz allowlist is empty');
  await db.collection('users').updateOne(
    { _id: E2E_STARTER_QUIZ.author },
    {
      $setOnInsert: {
        authVersion: 0,
        createdAt: now,
        disable: 0,
        displayName: 'E2E Starter Author',
        email: E2E_STARTER_QUIZ.authorEmail,
        role: 'user',
      },
    },
    { upsert: true },
  );
  await db.collection('quizzes').updateOne(
    { slug },
    {
      $setOnInsert: {
        author: E2E_STARTER_QUIZ.author,
        createdAt: now,
        questions: [
          {
            _id: new ObjectId(),
            correctIndex: 0,
            options: ['The starter card', 'Nothing'],
            question: E2E_STARTER_QUIZ.question,
            type: 'single',
          },
        ],
        slug,
        title: E2E_STARTER_QUIZ.title,
        updatedAt: now,
        visibility: 'public',
      },
    },
    { upsert: true },
  );
  return slug;
}

/**
 * A real one-page PDF.
 *
 * The upload page counts pages before it will accept a file, so a handful of
 * bytes that merely start with `%PDF` is rejected as unreadable and never
 * reaches the upload at all — the flow then asserts against a form that is
 * still empty.
 */
async function singlePagePdf(): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return Buffer.from(await pdf.save());
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
      email: createE2EUserEmail('regular', runId),
    };
    const admin: SeededUser = {
      id: new ObjectId(),
      email: createE2EUserEmail('admin', runId),
    };
    const target: SeededUser = {
      id: new ObjectId(),
      email: createE2EUserEmail('target', runId),
    };
    const quizId = new ObjectId();
    const questionId = new ObjectId();
    const quizSlug = `e2e-critical-${runId}`.toLowerCase();
    const planId = `e2e-plan-${runId}`;
    // Namespaced like the id and the slug above, and for the same reason: the
    // subscription flow finds its plan by heading text, so a constant name
    // makes two concurrently seeded fixtures indistinguishable. Every project
    // in the matrix seeds into this one database, so that happens on any run.
    const planName = `E2E Premium Monthly ${runId}`;

    // Shared singleton fence for admin mutations — insert-once, never cleaned up per-run.
    await ensureCanonicalActiveAdminFence(db, now);

    // Clearing the shared per-IP budget here is safe in a way asserting on it
    // is not: resetting a counter can only ever let a login through.
    await db.collection('auth_rate_limits').deleteMany({
      key: {
        $in: [
          ...ownedCredentialsRateLimitKeys([regular.email, admin.email, target.email]),
          ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
        ],
      },
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
      visibility: 'public',
    });

    await db
      .collection<{
        _id: string;
        _e2eRun: string;
        createdAt: Date;
        duration: string;
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
        isActive: true,
        name: planName,
        price: 49_000,
        updatedAt: now,
      });

    return { admin, client, db, planId, planName, quizId, quizSlug, regular, runId, target };
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
  const ownedRateLimitKeys = ownedCredentialsRateLimitKeys(emails);
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
      db.collection('auth_rate_limits').deleteMany({
        key: { $in: [...ownedRateLimitKeys, ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS] },
      }),
      db.collection('llm_rate_limits').deleteMany({ key: llmRateLimitKeyPattern }),
      db.collection('adminactionaudits').deleteMany({
        $or: [
          { entityType: 'quiz', entityId: fixture.quizId.toHexString() },
          { entityType: 'user', entityId: { $in: userIdStrings } },
        ],
      }),
    ]);
    // Quizzes created through the app carry no `_e2eRun` tag. Remove them by
    // author before the users go, or they are left orphaned and break admin
    // Top creators (RIN-634).
    await db.collection('quizzes').deleteMany({
      $or: [{ _e2eRun: runId }, { author: { $in: userIds } }],
    });
    await db.collection('plans').deleteMany({ _e2eRun: runId });
    await db.collection('users').deleteMany({ _e2eRun: runId });

    const remaining = await Promise.all([
      db.collection('users').countDocuments({ _e2eRun: runId }),
      db.collection('quizzes').countDocuments({
        $or: [{ _e2eRun: runId }, { author: { $in: userIds } }],
      }),
      db.collection('plans').countDocuments({ _e2eRun: runId }),
      db.collection('attempts').countDocuments({ quiz: fixture.quizId }),
      db.collection('userprogresses').countDocuments({ userId: { $in: userIdStrings } }),
      db.collection('auth_rate_limits').countDocuments({ key: { $in: ownedRateLimitKeys } }),
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

  const session = await readSession(page);
  expect(session.user).toMatchObject({
    email: user.email,
    id: user.id.toHexString(),
  });
  return session;
}

test.describe('production critical paths', () => {
  test('persists auth, enforces roles, and logs out @critical-auth', async ({
    browserName,
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const session = await login(page, fixture.regular);
      expect(session.user?.role).toBe('user');

      await page.reload();
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);
      expect(await readSession(page)).toMatchObject({
        user: { email: fixture.regular.email, id: fixture.regular.id.toHexString() },
      });

      const skipLink = page.getByRole('link', { name: 'Skip to main content' });
      await expect(skipLink).toHaveAttribute('href', '#app-main-content');
      // Safari keeps links out of the tab sequence unless the user opts in, and
      // WebKit here honours that default. Reaching the link by Tab is therefore
      // a Chromium-only assertion; what the skip link is for — moving focus to
      // the main region — is asserted on every browser.
      if (browserName === 'webkit') {
        await skipLink.focus();
      } else {
        await page.keyboard.press('Tab');
      }
      await expect(skipLink).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#app-main-content')).toBeFocused();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('a[aria-current="page"]:visible')).not.toHaveCount(0);

      await page.goto('/en/quizzes');
      await expect(page.getByRole('heading', { name: 'Quizzes', level: 1 })).toBeAttached();
      await expect(page.locator('main h1').locator('..')).toHaveCSS('max-width', '1320px');
      const filterButtons = page
        .getByRole('group', { name: 'Filter quiz visibility' })
        .getByRole('button');
      const filterButtonCount = await filterButtons.count();
      for (let index = 0; index < filterButtonCount; index += 1) {
        const bounds = await filterButtons.nth(index).boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }

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
      // Learner Lookup lives on the stats page, behind the same admin layout.
      await page.goto('/en/admin/stats');
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

  test('retries the missed questions from the result page as a stored attempt @critical-retry', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const submitQuiz = async (): Promise<void> => {
        const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
        if (await desktopSubmit.isVisible()) {
          await desktopSubmit.click();
        } else {
          await page.getByRole('button', { name: /complete \(1\/1 answered\)/i }).click();
        }
      };
      const resultUrl = new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`);

      await login(page, fixture.regular);
      await page.goto(`/en/quiz/${fixture.quizSlug}`);
      await page.getByText('This answer is intentionally incorrect', { exact: true }).click();
      await submitQuiz();
      await page.waitForURL(resultUrl);

      const source = await fixture.db.collection('attempts').findOne({
        quiz: fixture.quizId,
        user: fixture.regular.id,
      });
      expect(source).toMatchObject({ score: 0, totalQuestions: 1 });
      const sourceId = String(source?._id);

      // AC2: the primary action and the opt-in render with the result.
      await expect(page.getByLabel('Email me a 2-minute review in 2 days')).not.toBeChecked();
      await Promise.all([
        page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}\\?retryOf=${sourceId}`)),
        page.getByRole('link', { name: 'Retry the 1 you missed', exact: true }).click(),
      ]);

      await expect(
        page.getByText('Retry: 1 question', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await page.getByText('Production is the correct choice', { exact: true }).click();
      await submitQuiz();
      await page.waitForURL(resultUrl);
      await expect(page.getByText('Retry of missed questions', { exact: true })).toBeVisible();
      await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();

      const retry = await fixture.db.collection('attempts').findOne({
        quiz: fixture.quizId,
        user: fixture.regular.id,
        retryOfAttemptId: source?._id,
      });
      expect(retry).toMatchObject({ questionIndices: [0], score: 100, totalQuestions: 1 });
    });
  });

  test('points a new learner from the dashboard to a starter quiz @critical-starter', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      // The target fixture has no attempt and no authored quiz: a new learner.
      await login(page, fixture.target);

      const block = page.getByTestId('starter-quiz-block');
      await expect(block).toBeInViewport();
      await expect(block.getByText(E2E_STARTER_QUIZ.title)).toBeVisible();
      await expect(page.getByTestId('home-hero-cta')).toHaveAttribute(
        'href',
        `/en/quiz/${starterSlug}`,
      );
      await expect(
        page.getByRole('link', { name: 'Or personalize learning by uploading a PDF' }),
      ).toHaveAttribute('href', '/en/adaptive');

      await Promise.all([
        page.waitForURL(new RegExp(`/en/quiz/${starterSlug}(?:[/?#]|$)`)),
        page.getByTestId('starter-quiz-primary').click(),
      ]);
      await expect(page.getByText(E2E_STARTER_QUIZ.question)).toBeVisible();
    });
  });

  test('sends a new learner signing in with no destination into the starter quiz @critical-starter', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      // RIN-913: no callbackUrl and no skip cookie. The target fixture has no
      // attempt and no authored quiz, so /start opens the starter quiz.
      await page.addInitScript(() => {
        window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
      });
      await page.goto('/en/login');
      await page.getByLabel('Email Address').fill(fixture.target.email);
      await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
      await Promise.all([
        page.waitForURL(new RegExp(`/en/quiz/${starterSlug}\\?entry=post_signin_starter$`)),
        page.getByRole('button', { name: 'Sign In', exact: true }).click(),
      ]);

      await expect(page.getByText('Try a 2-minute quiz to see how Rinkuzu works')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Skip', exact: true })).toHaveAttribute(
        'href',
        '/en/dashboard',
      );
      await expect(page.getByText(E2E_STARTER_QUIZ.question)).toBeVisible();
      await page.getByText('The starter card', { exact: true }).click();

      const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
      if (await desktopSubmit.isVisible()) {
        await desktopSubmit.click();
      } else {
        await page.getByRole('button', { name: /complete \(1\/1 answered\)/i }).click();
      }
      await page.waitForURL(new RegExp(`/en/quiz/${starterSlug}/result\\?attemptId=`));
      await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();

      const starterQuiz = await fixture.db.collection('quizzes').findOne({ slug: starterSlug });
      const attempt = await fixture.db.collection('attempts').findOne({
        quiz: starterQuiz?._id,
        user: fixture.target.id,
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
      let objectStorageUploadBytes = 0;
      await page.exposeFunction('recordObjectStorageUploadBytes', (byteLength: number) => {
        objectStorageUploadBytes = byteLength;
      });
      await page.addInitScript(() => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (requestUrl.includes('/__e2e-object-storage/') && init?.method === 'PUT') {
            const uploadBodyBytes = init.body instanceof Blob ? init.body.size : 0;
            await (
              window as typeof window & {
                recordObjectStorageUploadBytes: (byteLength: number) => Promise<void>;
              }
            ).recordObjectStorageUploadBytes(uploadBodyBytes);
          }
          return originalFetch(input, init);
        };
      });

      await login(page, fixture.regular);
      const origin = new URL(page.url()).origin;
      const subjectName = `E2E Adaptive ${fixture.runId}`;
      let presignedPayload: unknown = null;

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
              // The client rejects an envelope without these before it uploads
              // anything, so a stub that omits them never exercises the upload
              // it exists to exercise. `PUT` is what the byte counter observes;
              // the field bag is empty because a presigned PUT carries none.
              uploadMethod: 'PUT',
              uploadHeaders: { 'Content-Type': 'application/pdf' },
              uploadFields: {},
            },
          }),
        });
      });
      await page.route('**/__e2e-object-storage/**', async (route) => {
        await route.fulfill({ status: 200, body: '' });
      });

      await page.goto('/en/adaptive/upload');
      // The page is interactive only once the entitlement policy that supplies
      // its page and byte limits has loaded, and nothing may be typed before
      // then: a controlled input written while React is still hydrating keeps
      // the text in the DOM — long enough to satisfy an assertion — and loses
      // it to the first render React does, after which the form refuses the
      // upload for a subject name the test did set.
      //
      // The dropzone root is what says so. It is given a tab stop only when the
      // policy has arrived, which cannot happen before hydration. Its file
      // input cannot: react-dropzone never puts `disabled` on it, so asking
      // whether that is enabled is answered `yes` by the server-rendered HTML
      // and gates nothing.
      const pdfInput = page.locator('input[type="file"]');
      await expect(page.locator('.upload-dropzone')).toHaveAttribute('tabindex', '0');

      const subjectInput = page.getByLabel('Subject Name');
      await subjectInput.fill(subjectName);
      await expect(subjectInput).toHaveValue(subjectName);
      await pdfInput.setInputFiles({
        name: 'production-e2e.pdf',
        mimeType: 'application/pdf',
        buffer: await singlePagePdf(),
      });

      // Choosing a file stages it; the upload is a deliberate second step so
      // the page can show what is about to be processed before it starts.
      const startProcessing = page.getByRole('button', { name: 'Create learning path' });
      await expect(startProcessing).toBeEnabled();
      await startProcessing.click();

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

  test('starts the canonical PayOS checkout @critical-subscription', async ({ page }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      let quotePayload: unknown = null;
      let createOrderPayload: unknown = null;

      await page.route('**/api/billing/csrf', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { token: 'e2e-billing-csrf' } }),
        });
      });
      await page.route('**/api/billing/quotes', async (route) => {
        quotePayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'e2e-quote-token',
              quote: {
                baseAmount: 49_000,
                discountAmount: 0,
                finalAmount: 49_000,
                currency: 'VND',
                durationUnit: 'month',
                durationValue: 1,
                expiresAt: Date.now() + 300_000,
              },
              plan: { id: fixture.planId, name: fixture.planName },
            },
          }),
        });
      });
      await page.route('**/api/billing/orders', async (route) => {
        createOrderPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'e2e-billing-order',
              plan: { id: fixture.planId, name: fixture.planName },
              currency: 'VND',
              baseAmount: 49_000,
              discountAmount: 0,
              finalAmount: 49_000,
              receivedAmount: 0,
              collectionStatus: 'unpaid',
              attemptCollectionStatus: 'pending',
              fulfillmentStatus: 'unfulfilled',
              settlementStatus: 'unsettled',
              checkoutUrl: 'https://pay.payos.vn/web/e2e-production-checkout',
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
      // Scoped to this run's own plan card. The catalogue is shared and every
      // project seeds a plan of its own into it concurrently, so a page-wide
      // "Subscribe" resolves to one button per plan in flight.
      const planCard = page.getByTestId(`plan-card-${fixture.planId}`);
      await expect(planCard.getByRole('heading', { name: fixture.planName })).toBeVisible();
      await planCard.getByRole('button', { name: 'Subscribe', exact: true }).click();
      await page.waitForURL(/\/en\/checkout\?plan=/);
      await expect(page.getByRole('heading', { name: 'Review and pay' })).toBeVisible();
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: /Continue to PayOS/ }).click();
      await page.waitForURL('https://pay.payos.vn/web/e2e-production-checkout');
      await expect(
        page.getByRole('heading', { name: 'PayOS checkout boundary reached' }),
      ).toBeVisible();
      expect(quotePayload).toEqual({ planId: fixture.planId, promoCode: null });
      expect(createOrderPayload).toEqual({ quoteToken: 'e2e-quote-token' });
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

  test('looks up a learner and opens the audited read-only drill-down @critical-admin-learner-lookup', async ({
    page,
    request,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const targetId = fixture.target.id.toHexString();
      const lookupApis = [
        `/api/admin/personal-learning/learners?search=${encodeURIComponent(fixture.target.email)}`,
        `/api/admin/personal-learning/subjects?user_id=${targetId}`,
      ];

      // Anonymous: `request` is a cookie-less context, and the page has no session yet.
      for (const path of lookupApis) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(401);
        expect(await response.json()).toMatchObject({
          error: { code: 'unauthorized' },
          success: false,
        });
      }
      await page.goto('/en/admin/stats');
      await expect(page).toHaveURL(/\/en\/login\?callbackUrl=%2Fadmin%2Fstats/);

      // Signed in without the admin role: the page redirects and both APIs refuse.
      await login(page, fixture.regular);
      await page.goto('/en/admin/stats');
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);
      const denied = await page.evaluate(
        (paths) =>
          Promise.all(
            paths.map(async (path) => {
              const response = await fetch(path, { cache: 'no-store' });
              return { body: await response.json(), path, status: response.status };
            }),
          ),
        lookupApis,
      );
      expect(denied).toEqual(
        lookupApis.map((path) => ({
          body: expect.objectContaining({
            error: expect.objectContaining({ code: 'forbidden' }),
            success: false,
          }),
          path,
          status: 403,
        })),
      );
      await page.context().clearCookies();

      await login(page, fixture.admin);
      await page.goto('/en/admin/stats');
      await page.getByRole('button', { name: 'Learner Lookup' }).click();
      await page.getByLabel('Name or email').fill(fixture.target.email);
      await page.getByRole('button', { name: 'Search', exact: true }).click();

      const result = page
        .getByRole('table', { name: 'Matching learners' })
        .getByRole('row')
        .filter({ hasText: fixture.target.email });
      await expect(result).toHaveCount(1);
      await expect(result).toContainText('E2E Role Target');
      await result
        .getByRole('button', { name: `View learning for ${fixture.target.email}` })
        .click();

      const drawer = page.getByRole('dialog');
      const row = drawer.getByRole('row', { name: /e2e-lookup-notes\.pdf/ });
      // File, pipeline status, progress status, accuracy, progress, last activity (UTC).
      await expect(row.getByRole('cell')).toHaveText([
        'e2e-lookup-notes.pdf',
        'completed',
        'active',
        '80%',
        '50%',
        /^30 Oct 2026,? 12:00 UTC$/,
      ]);
      await expect(drawer).not.toContainText('E2E_RAW_DOCUMENT_TEXT');

      // The denied calls above recorded nothing; the one admin view recorded exactly one entry.
      const audits = await fixture.db
        .collection('adminactionaudits')
        .find({ entityType: 'user', entityId: targetId })
        .toArray();
      expect(
        audits.map((audit) => ({
          action: audit['action'],
          actorEmail: audit['actorEmail'],
          actorId: String(audit['actorId']),
          entityId: audit['entityId'],
        })),
      ).toEqual([
        {
          action: 'personal_learning.learner_view',
          actorEmail: fixture.admin.email,
          actorId: fixture.admin.id.toHexString(),
          entityId: targetId,
        },
      ]);
    });
  });

  test('hides a public quiz with an audited admin visibility toggle and reverts it @critical-admin-quiz-visibility', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const quizHexId = fixture.quizId.toHexString();
      // A run-unique title so the admin search lands on this run's fixture only.
      const title = `E2E Visibility ${fixture.runId}`;
      await fixture.db
        .collection('quizzes')
        .updateOne({ _id: fixture.quizId }, { $set: { title } });

      // `request` is a separate, cookie-less context: it plays the anonymous visitor.
      const anonymousPlayStatus = async () =>
        (await request.get(`/api/quiz/${fixture.quizSlug}/play`)).status();
      const publicListSlugs = async () => {
        const response = await request.get(`/api/quizzes?search=${encodeURIComponent(title)}`);
        expect(response.status()).toBe(200);
        const body = (await response.json()) as { data: { quizzes: { slug: string }[] } };
        return body.data.quizzes.map((quiz) => quiz.slug);
      };
      expect(await anonymousPlayStatus()).toBe(200);
      expect(await publicListSlugs()).toContain(fixture.quizSlug);

      await login(page, fixture.admin);
      await page.goto('/en/admin/quizzes');
      await expect(page.getByRole('heading', { name: 'Quiz Management' })).toBeVisible();
      const search = page.getByLabel('Search quizzes...');
      await search.fill(title);
      await search.press('Enter');
      const row = page.locator('article').filter({ hasText: title });
      await expect(row).toHaveCount(1);

      await row.getByRole('button', { name: 'Make private', exact: true }).click();
      const confirmPrivate = page.getByRole('dialog');
      await expect(confirmPrivate).toContainText(title);
      await confirmPrivate.getByRole('button', { name: 'Make private', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Make public', exact: true })).toBeVisible();

      const hidden = await fixture.db.collection('quizzes').findOne({ _id: fixture.quizId });
      expect(hidden?.['visibility']).toBe('personal');
      expect(await anonymousPlayStatus()).toBe(401);
      expect(await publicListSlugs()).not.toContain(fixture.quizSlug);

      await row.getByRole('button', { name: 'Make public', exact: true }).click();
      const confirmPublic = page.getByRole('dialog');
      await confirmPublic.getByRole('button', { name: 'Make public', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Make private', exact: true })).toBeVisible();

      const restored = await fixture.db.collection('quizzes').findOne({ _id: fixture.quizId });
      expect(restored?.['visibility']).toBe('public');
      expect(await anonymousPlayStatus()).toBe(200);

      const audits = await fixture.db
        .collection('adminactionaudits')
        .find({ entityType: 'quiz', entityId: quizHexId })
        .sort({ createdAt: 1 })
        .toArray();
      expect(
        audits.map((audit) => ({
          action: audit['action'],
          actorId: String(audit['actorId']),
          details: audit['details'],
        })),
      ).toEqual([
        {
          action: 'quiz.visibility.changed',
          actorId: fixture.admin.id.toHexString(),
          details: { slug: fixture.quizSlug, from: 'public', to: 'personal' },
        },
        {
          action: 'quiz.visibility.changed',
          actorId: fixture.admin.id.toHexString(),
          details: { slug: fixture.quizSlug, from: 'personal', to: 'public' },
        },
      ]);
    });
  });

  test('marks and clears an audited test-account flag from the admin users page @critical-admin-test-account', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const targetId = fixture.target.id.toHexString();
      const flagRoute = `/api/admin/users/${targetId}/test-account`;
      const readFlag = async () =>
        (await fixture.db.collection('users').findOne({ _id: fixture.target.id }))?.[
          'isTestAccount'
        ];

      // `request` is cookie-less: the anonymous caller is refused before any write.
      const anonymous = await request.patch(flagRoute, {
        data: { isTestAccount: true },
        headers: { 'Sec-Fetch-Site': 'same-origin' },
      });
      expect(anonymous.status()).toBe(401);

      // A signed-in learner is refused too, from an isolated context.
      const baseURL = testInfo.project.use.baseURL;
      const learnerContext = await browser.newContext(
        typeof baseURL === 'string' && baseURL.length > 0 ? { baseURL } : undefined,
      );
      try {
        const learnerPage = await learnerContext.newPage();
        await login(learnerPage, fixture.regular);
        const learnerStatus = await learnerPage.evaluate(async (route) => {
          const response = await fetch(route, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTestAccount: true }),
          });
          return response.status;
        }, flagRoute);
        expect(learnerStatus).toBe(403);
      } finally {
        await learnerContext.close();
      }
      expect(await readFlag()).toBeUndefined();

      await login(page, fixture.admin);
      await page.goto('/en/admin/users');
      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
      const search = page.getByLabel('Search users by email...');
      await search.fill(fixture.target.email);
      await search.press('Enter');
      const row = page.getByRole('row').filter({ hasText: fixture.target.email });
      await expect(row).toHaveCount(1);
      await expect(row.getByText('Test account', { exact: true })).toHaveCount(0);

      await row.getByRole('button', { name: 'Mark as test', exact: true }).click();
      const confirmMark = page.getByRole('dialog');
      await expect(confirmMark).toContainText(fixture.target.email);
      await confirmMark.getByRole('button', { name: 'Mark as test', exact: true }).click();
      await expect(row.getByText('Test account', { exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Unmark test', exact: true })).toBeVisible();
      expect(await readFlag()).toBe(true);

      await row.getByRole('button', { name: 'Unmark test', exact: true }).click();
      const confirmClear = page.getByRole('dialog');
      await confirmClear.getByRole('button', { name: 'Unmark test', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Mark as test', exact: true })).toBeVisible();
      await expect(row.getByText('Test account', { exact: true })).toHaveCount(0);
      expect(await readFlag()).toBe(false);

      const audits = await fixture.db
        .collection('adminactionaudits')
        .find({ entityType: 'user', entityId: targetId, action: 'user.test_account.set' })
        .sort({ createdAt: 1 })
        .toArray();
      expect(
        audits.map((audit) => ({
          actorId: String(audit['actorId']),
          details: audit['details'],
        })),
      ).toEqual([
        {
          actorId: fixture.admin.id.toHexString(),
          details: { isTestAccount: 'true', previous: 'false' },
        },
        {
          actorId: fixture.admin.id.toHexString(),
          details: { isTestAccount: 'false', previous: 'true' },
        },
      ]);
    });
  });

  test('configures masked AI providers and preserves tutor fallback order @critical-admin-ai-settings', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const userId = fixture.admin.id.toHexString();
      const primarySecret = 'e2e-primary-secret-ALPHA';
      const fallbackSecret = 'e2e-fallback-secret-BETA';
      const responseBodies: Promise<string>[] = [];

      page.on('response', (response) => {
        if (response.url().includes('/api/admin/ai-settings')) {
          responseBodies.push(response.text().catch(() => ''));
        }
      });

      await login(page, fixture.admin);
      await page.goto('/en/admin/ai-settings');
      await expect(page.getByRole('heading', { name: 'AI Providers & Routing' })).toBeVisible();

      // The create form is behind a toggle. While it is closed the only control
      // with this label is the toggle; once open the toggle reads "Cancel" and
      // the label belongs solely to the form's submit, so one locator addresses
      // the right control at each step.
      await page.getByRole('button', { name: 'Add provider', exact: true }).click();
      const addProvider = page.getByRole('button', { name: 'Add provider', exact: true });
      const providerForm = page.locator('form').filter({ has: addProvider });
      // Labelled, not placeholdered: the label element wraps the input, so the
      // accessible name is what identifies it. Same for every field below.
      await providerForm.getByLabel('Provider name').fill('E2E Provider');
      await providerForm
        .getByPlaceholder('https://api.example.com/v1')
        .fill('https://api.e2e.example/v1');
      await addProvider.click();
      await expect(page.getByText('E2E Provider', { exact: true }).first()).toBeVisible();

      // Tabs, not buttons: they sit in a tablist and expose the tab role.
      await page.getByRole('tab', { name: 'API keys', exact: true }).click();
      const addKey = page.getByRole('button', { name: 'Add key', exact: true });
      const keyForm = page.locator('form').filter({ has: addKey });

      await keyForm.getByLabel('Key label').fill('Primary key');
      await keyForm.getByLabel('Paste API key').fill(primarySecret);
      await keyForm.getByLabel('Key priority').fill('1');
      await addKey.click();
      await expect(page.getByText('••••LPHA', { exact: true })).toBeVisible();

      // The list re-renders from the reload inside the save, a render or more
      // before the form resets. Wait for the reset (and the submit to leave its
      // busy state) before typing the second key, or the reset wipes it.
      await expect(keyForm.getByLabel('Key label')).toHaveValue('');
      await expect(keyForm.getByLabel('Paste API key')).toHaveValue('');
      await expect(keyForm.getByLabel('Key priority')).toHaveValue('100');
      await expect(addKey).toBeEnabled();

      await keyForm.getByLabel('Key label').fill('Fallback key');
      await keyForm.getByLabel('Paste API key').fill(fallbackSecret);
      await keyForm.getByLabel('Key priority').fill('10');
      await expect(keyForm.getByLabel('Key label')).toHaveValue('Fallback key');
      await expect(keyForm.getByLabel('Paste API key')).toHaveValue(fallbackSecret);
      await expect(keyForm.getByLabel('Key priority')).toHaveValue('10');
      await addKey.click();
      await expect(page.getByText('••••BETA', { exact: true })).toBeVisible();

      await page.getByRole('tab', { name: 'Models', exact: true }).click();
      const addModel = page.getByRole('button', { name: 'Add model', exact: true });
      const modelForm = page.locator('form').filter({ has: addModel });

      await modelForm.getByLabel('Display name').fill('Primary Tutor');
      await modelForm.getByLabel('Upstream model name').fill('e2e-primary-model');
      await addModel.click();
      await expect(page.getByText('Primary Tutor', { exact: true })).toBeVisible();

      // Same ordering as the keys: the list shows the new model before the
      // form resets, so wait for the reset before typing the fallback model.
      await expect(modelForm.getByLabel('Display name')).toHaveValue('');
      await expect(modelForm.getByLabel('Upstream model name')).toHaveValue('');
      await expect(addModel).toBeEnabled();

      await modelForm.getByLabel('Display name').fill('Fallback Tutor');
      await modelForm.getByLabel('Upstream model name').fill('e2e-fallback-model');
      await expect(modelForm.getByLabel('Display name')).toHaveValue('Fallback Tutor');
      await expect(modelForm.getByLabel('Upstream model name')).toHaveValue('e2e-fallback-model');
      await addModel.click();
      await expect(page.getByText('Fallback Tutor', { exact: true })).toBeVisible();

      // Routing is a workspace of its own, not a tab on the provider: the
      // fallback order it edits is global, not per-provider.
      await page.getByRole('button', { name: 'Global routing', exact: true }).click();
      const routeSelect = page.getByRole('combobox', {
        name: 'Add a compatible model to Ask Rin-chan tutor chat',
      });
      await routeSelect.selectOption({ label: 'Primary Tutor' });
      await routeSelect.selectOption({ label: 'Fallback Tutor' });
      // The numbered rows below render from the draft, so they are visible
      // before anything is saved. Wait for the PUT to succeed and the unsaved
      // notice to clear before navigating, or the reload aborts the save.
      const routingSaved = page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/ai-settings/routing') &&
          response.request().method() === 'PUT' &&
          response.ok(),
      );
      await page.getByRole('button', { name: 'Save routing atomically', exact: true }).click();
      await routingSaved;
      await expect(
        page.getByRole('status').filter({ hasText: 'This routing draft has unsaved changes.' }),
      ).toBeHidden();
      // Substring, not exact: each row carries the owning provider's badge in
      // the same element, so the position and the model name are a prefix of
      // its text rather than the whole of it.
      await expect(page.getByText('1. Primary Tutor')).toBeVisible();
      await expect(page.getByText('2. Fallback Tutor')).toBeVisible();

      await page.goto('/en/admin/ai-settings?tab=routing&provider=provider-1');
      await expect(page.getByText('1. Primary Tutor')).toBeVisible();
      await expect(page.getByText('2. Fallback Tutor')).toBeVisible();

      const fallback = await request.post(
        'http://127.0.0.1:8000/__e2e/llm-settings/simulate-fallback',
        {
          data: { action: 'ask_rin_chan', userId },
          headers: { 'x-e2e-control-token': E2E_CONTROL_TOKEN },
        },
      );
      expect(fallback.ok()).toBeTruthy();
      await expect(fallback.json()).resolves.toMatchObject({
        success: true,
        data: {
          selected_model_id: 'model-2',
          attempts: [
            { attempt_index: 1, model_id: 'model-1', outcome: 'recoverable_failure' },
            { attempt_index: 2, model_id: 'model-2', outcome: 'success' },
          ],
        },
      });

      const publicPayloads = (await Promise.all(responseBodies)).join('\n');
      expect(publicPayloads).not.toContain(primarySecret);
      expect(publicPayloads).not.toContain(fallbackSecret);
      await expect(page.locator('body')).not.toContainText(primarySecret);
      await expect(page.locator('body')).not.toContainText(fallbackSecret);

      const reset = await request.post('http://127.0.0.1:8000/__e2e/llm-settings/reset', {
        data: { userId },
        headers: { 'x-e2e-control-token': E2E_CONTROL_TOKEN },
      });
      expect(reset.ok()).toBeTruthy();
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
        expect(disabledDoc?.['authVersion']).toBe(2);
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
        expect(restoredDoc?.['authVersion']).toBe(3);
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
