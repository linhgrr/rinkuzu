import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS } from './support/auth-rate-limit-keys';
import { createE2EUserEmail } from './support/fixture-identifiers';
import { skipPostSignInStarter } from './support/post-signin';

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
  /** The English seed row of scripts/migrate-starter-quizzes.mjs (RIN-1181). */
  slug: 'how-to-remember-what-you-study-7-question-starter-quiz-093947',
} as const;

// The specs run on /en, where the dashboard, /start and the activation email
// all pick the English starter once it exists. Seeding another one would make
// the pick depend on which spec ran first (RIN-1000). Starters live in the
// `starterquizzes` collection, keyed on the quiz id (RIN-1181).
async function ensureStarterQuiz(db: Db, now: Date): Promise<string> {
  const slug = E2E_STARTER_QUIZ.slug;
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
  const quiz = await db
    .collection<{ _id: ObjectId }>('quizzes')
    .findOne({ slug }, { projection: { _id: 1 } });
  if (!quiz) throw new Error('E2E starter quiz was not seeded');
  await db.collection('starterquizzes').updateOne(
    { quiz: quiz._id },
    {
      $setOnInsert: { createdAt: now, locale: 'en', order: 2, quiz: quiz._id },
      $set: { updatedAt: now },
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
      db.collection('marketingpreferences').deleteMany({ userId: { $in: userIds } }),
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

const E2E_GUEST_DRAFT_QUESTION = 'Which organelle makes ATP in this fake guest draft?';

interface SeededGuestDraft {
  id: ObjectId;
  token: string;
  apiDraftId: string;
}

/** A ready guest draft, as the status poll leaves it (RIN-1447): no OCR in e2e. */
async function seedReadyGuestDraft(
  db: Db,
  token: string = randomBytes(32).toString('base64url'),
): Promise<SeededGuestDraft> {
  const id = new ObjectId();
  const apiDraftId = `e2e-guest-${randomUUID()}`;
  const now = new Date();
  await db.collection('guestquizdrafts').insertOne({
    _id: id,
    tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
    apiDraftId,
    status: 'ready',
    title: 'E2E guest draft quiz',
    questions: [
      {
        _id: new ObjectId(),
        question: E2E_GUEST_DRAFT_QUESTION,
        options: ['Mitochondria', 'Ribosome'],
        type: 'single',
        correctIndex: 0,
      },
    ],
    locale: 'en',
    entry: 'landing',
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  return { id, token, apiDraftId };
}

/** `auth.verifyEmailSuccess` in each locale (RIN-1487). */
const VERIFY_EMAIL_SUCCESS = {
  en: 'Email verified. You can now sign in.',
  vi: 'Email đã được xác minh. Bạn có thể đăng nhập ngay.',
} as const;

/** What the guest upload page leaves in the browser (`guest-draft-claims.ts`), set once. */
async function storeGuestDraftToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => {
    if (window.sessionStorage.getItem('e2e-guest-draft-seeded')) return;
    window.sessionStorage.setItem('e2e-guest-draft-seeded', '1');
    window.localStorage.setItem(
      'rinkuzu.guestDrafts.v1',
      JSON.stringify([{ token: value, createdAt: Date.now() }]),
    );
  }, token);
}

/** A one-page PDF the browser check accepts (RIN-1448); its content never reaches OCR. */
async function fakeOnePagePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return Buffer.from(await doc.save());
}

const GUEST_UPLOAD_COPY = {
  en: {
    create: 'Create quiz',
    notice: /Kept for 24 hours/,
    finish: /finish \(1\/1 answered\)/i,
    submit: 'Submit Quiz',
    saveTitle: 'Sign up to save this quiz and your result',
    expiredTitle: 'This quiz has expired',
    library: 'Go to my library',
  },
  vi: {
    create: 'Tạo quiz',
    notice: /Chỉ lưu 24 giờ/,
    finish: /hoàn thành \(1\/1 đã trả lời\)/i,
    submit: 'Nộp bài',
    saveTitle: 'Đăng ký để lưu quiz này và kết quả',
    expiredTitle: 'Quiz này đã hết hạn',
    library: 'Tới thư viện của tôi',
  },
} as const;

/** The upload answer when the draft is ready at once (no OCR in e2e). */
const READY_GUEST_DRAFT_BODY = JSON.stringify({
  success: true,
  data: {
    status: 'ready',
    progressPercent: 100,
    title: 'E2E guest draft quiz',
    questionCount: 1,
    failureReason: null,
  },
});

async function finishOneQuestionQuiz(
  page: Page,
  copy: (typeof GUEST_UPLOAD_COPY)[keyof typeof GUEST_UPLOAD_COPY],
): Promise<void> {
  await chooseOption(page, 'Mitochondria');
  const desktopSubmit = page.getByRole('button', { name: copy.submit, exact: true });
  if (await desktopSubmit.isVisible()) {
    await desktopSubmit.click();
  } else {
    await page.getByRole('button', { name: copy.finish }).click();
  }
}

async function cleanupGuestDraft(db: Db, draft: SeededGuestDraft): Promise<void> {
  await Promise.all([
    db.collection('guestquizdrafts').deleteMany({ _id: draft.id }),
    db.collection('quizzes').deleteMany({ sourceDraftId: draft.apiDraftId }),
  ]);
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

/**
 * Records client analytics events in the page (RIN-1000). Consent is granted so
 * `captureAnalyticsEvent` runs; `window.gtag` is pinned to a recorder the app
 * cannot replace, so nothing leaves the browser through it.
 */
async function recordAnalyticsEvents(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
    const events: Array<{ name: unknown; properties: unknown }> = [];
    const record = (...args: unknown[]) => {
      if (args[0] === 'event') events.push({ name: args[1], properties: args[2] });
    };
    Object.defineProperty(window, '__rkEvents', { value: events });
    Object.defineProperty(window, 'gtag', {
      configurable: true,
      get: () => record,
      set: () => undefined,
    });
  });
}

/** Properties of the first recorded `name` event, or null before it fires. */
async function analyticsEventProperties(page: Page, name: string): Promise<unknown> {
  return page.evaluate((eventName) => {
    const events: unknown = Reflect.get(window, '__rkEvents');
    if (!Array.isArray(events)) return null;
    const found: unknown = events.find((event: { name?: unknown }) => event.name === eventName);
    return found && typeof found === 'object' ? Reflect.get(found, 'properties') : null;
  }, name);
}

async function quizCompletedProperties(page: Page): Promise<unknown> {
  return analyticsEventProperties(page, 'quiz_completed');
}

/**
 * Picks an answer once React owns the option (RIN-1129). The player server-renders the first
 * question (RIN-1032), so on a phone the option is visible, with `document.readyState` already
 * `complete`, before React owns it. A click on that server-rendered node is usually replayed, but
 * React then replaces the node, and under load about 1 in 20 such clicks was lost: the radio stayed
 * unchecked and the mobile footer stayed at "Finish (0/1 answered)". React tags each node it owns
 * with a `__reactProps$<id>` key holding its handlers, so wait for that key on the control that
 * takes the answer (the mobile option button, or the desktop option's input), not for visibility.
 */
async function chooseOption(page: Page, text: string): Promise<void> {
  const option = page.getByText(text, { exact: true });
  await expect(option).toBeVisible();
  await expect
    .poll(() =>
      option.evaluate((node) => {
        const control =
          node.closest('button') ?? node.closest('label')?.querySelector('input') ?? node;
        return Object.keys(control).some((key) => key.startsWith('__reactProps$'));
      }),
    )
    .toBe(true);
  await option.click();
}

async function submitStarterQuiz(page: Page, starterSlug: string): Promise<void> {
  await expect(page.getByText(E2E_STARTER_QUIZ.question)).toBeVisible();
  await chooseOption(page, 'The starter card');
  const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
  if (await desktopSubmit.isVisible()) {
    await desktopSubmit.click();
  } else {
    await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
  }
  await page.waitForURL(new RegExp(`/en/quiz/${starterSlug}/result\\?attemptId=`));
  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
}

/** The email CTA with an unsigned token: it must still land on the starter, recording nothing. */
const ACTIVATION_CLICK_PATH = '/api/email/activation-click?t=not-a-signed-token&l=en';
const ACTIVATION_LANDING_QUERY =
  '\\?entry=activation_email&utm_source=email&utm_campaign=activation_nudge$';

/** The click lands on the host it was opened on, or the session cookie is lost. */
async function expectActivationLanding(
  page: Page,
  starterSlug: string,
  testInfo: TestInfo,
): Promise<void> {
  await page.waitForURL(new RegExp(`/en/quiz/${starterSlug}${ACTIVATION_LANDING_QUERY}`));
  expect(new URL(page.url()).origin).toBe(new URL(String(testInfo.project.use.baseURL)).origin);
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
      await chooseOption(page, 'Production is the correct choice');

      const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
      if (await desktopSubmit.isVisible()) {
        await desktopSubmit.click();
      } else {
        await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
      }

      await page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`));
      await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
      await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();

      // RIN-989: on phones the Details card squeezed the prompt to one character per line
      // and pushed its buttons past the viewport. It must fit and wrap by words.
      const reviewedPrompt = page.getByRole('heading', {
        name: 'Which option proves the quiz lifecycle works?',
      });
      await expect(reviewedPrompt).toBeVisible();
      const promptBox = await reviewedPrompt.boundingBox();
      expect(promptBox?.height ?? Infinity).toBeLessThan(120);
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(0);

      const attempt = await fixture.db.collection('attempts').findOne({
        quiz: fixture.quizId,
        user: fixture.regular.id,
      });
      expect(attempt).toMatchObject({ score: 100, totalQuestions: 1 });
    });
  });

  // RIN-1202: the real /api/ask-rin-chan/agent route validates the client's AG-UI body with a
  // strict schema before it proxies to the adaptive API, so a field the client starts sending
  // turns every question into a 400. No page.route here: the run goes through the proxy to the
  // fake adaptive server, which streams the event order of rinkuzu-ai-api's assistant/agui.py.
  test('streams an Ask Rin-chan reply through the real proxy route @critical-ask-rin', async ({
    page,
  }, testInfo) => {
    // Sign-in, a played quiz and a streamed run: past the 30 s default under parallel load.
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      await page.goto(`/en/quiz/${fixture.quizSlug}`);
      await chooseOption(page, 'This answer is intentionally incorrect');
      const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
      if (await desktopSubmit.isVisible()) {
        await desktopSubmit.click();
      } else {
        await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
      }
      await page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`));

      // The empty state also flashes before the history load starts, and the load replaces the
      // thread when it lands: wait for it first, or the question is sent and then wiped.
      const historyLoaded = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.startsWith('/api/ask-rin-chan/conversations/') &&
          response.request().method() === 'GET',
      );
      const contextRegistered = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/ask-rin-chan/contexts' &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Ask Rin-chan', exact: true }).click();
      // The UI locale picks the reply language, and the proxy must pass it through (RIN-1270).
      const registration = await contextRegistered;
      expect(registration.request().postDataJSON()).toMatchObject({ locale: 'en' });
      expect(registration.status()).toBe(200);
      await historyLoaded;
      const panel = page.getByRole('dialog');
      await expect(
        panel.getByRole('heading', { name: "Let's work through this together" }),
      ).toBeVisible();

      const question = `Why is option two wrong? ${fixture.runId}`;
      await panel.getByRole('textbox', { name: 'Ask a question...' }).fill(question);
      const [agentResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/ask-rin-chan/agent' &&
            response.request().method() === 'POST',
        ),
        panel.getByRole('button', { name: 'Send', exact: true }).click(),
      ]);
      // On a rejection, name the schema issue: it is the client field the proxy now refuses.
      const rejection = agentResponse.ok() ? '' : await agentResponse.text();
      expect(agentResponse.status(), rejection).toBe(200);
      expect(agentResponse.headers()['content-type']).toContain('text/event-stream');

      await expect(
        panel.getByText(`Rin-chan read your question: "${question}". Start from the stem.`),
      ).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
      await expect(panel.getByRole('alert')).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
    });
  });

  test('saves a signed-out result to the learner who signs in after it @critical-quiz-guest-claim', async ({
    page,
  }, testInfo) => {
    // RIN-912 AC9: play signed out, submit, sign in from the result (email stands in
    // for Google here), land back on the full result, and find it in /history.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const learner = fixture.target;
      try {
        await page.addInitScript(() => {
          window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
        });
        await page.goto(`/en/quiz/${fixture.quizSlug}`);
        await expect(page.getByText('Which option proves the quiz lifecycle works?')).toBeVisible();
        await chooseOption(page, 'Production is the correct choice');
        const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
        if (await desktopSubmit.isVisible()) {
          await desktopSubmit.click();
        } else {
          await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
        }

        await page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`));
        const attemptId = new URL(page.url()).searchParams.get('attemptId') ?? '';
        const guestAttempt = await fixture.db
          .collection('attempts')
          .findOne({ _id: new ObjectId(attemptId) });
        expect(guestAttempt).toMatchObject({ quiz: fixture.quizId, score: 100 });
        expect(guestAttempt?.['user']).toBeUndefined();

        await page.getByRole('link', { name: 'Sign in with email' }).first().click();
        await page.waitForURL(/\/en\/login\?callbackUrl=/);
        await page.getByLabel('Email Address').fill(learner.email);
        await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await Promise.all([
          page.waitForURL(
            new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=${attemptId}`),
          ),
          page.getByRole('button', { name: 'Sign In', exact: true }).click(),
        ]);

        // The full review, read as the learner: no score-only fallback, no save card.
        await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
        await expect(
          page.getByText('Which option proves the quiz lifecycle works?').first(),
        ).toBeVisible();
        await expect(page.getByText("We can't open the question review")).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Sign in with email' })).toHaveCount(0);
        await expect
          .poll(() => page.evaluate(() => window.localStorage.getItem('rinkuzu.guestClaims.v1')))
          .toBeNull();

        const claimed = await fixture.db
          .collection('attempts')
          .findOne({ _id: new ObjectId(attemptId) });
        expect(claimed?.['user']).toEqual(learner.id);
        expect(claimed?.['claimedAt']).toBeInstanceOf(Date);

        await page.goto('/en/history');
        await expect(page).toHaveURL(/\/en\/history(?:[/?#]|$)/);
        await expect(page.getByText('Production Critical Quiz').first()).toBeVisible();

        // RIN-1204: all-attempts stats and the result filter. The one claimed attempt scored
        // 100, so "Needs work" is empty and "Show all" brings it back.
        await expect(page.getByText('Average score')).toBeVisible();
        await expect(page.getByText('100%').first()).toBeVisible();
        const resultFilter = page.getByRole('group', { name: 'Filter attempts by result' });
        await resultFilter.getByRole('button', { name: 'Needs work', exact: true }).click();
        await expect(page.getByText('No attempts need work. Nice.')).toBeVisible();
        await expect(page.getByText('Production Critical Quiz')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show all', exact: true }).click();
        await expect(page.getByText('Production Critical Quiz').first()).toBeVisible();
        await expect(
          resultFilter.getByRole('button', { name: 'All', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      } finally {
        await fixture.db.collection('auth_rate_limits').deleteMany({
          key: {
            $in: [
              `auth:attempt_claim_user:${learner.id.toHexString()}`,
              'auth:attempt_claim_ip:127.0.0.1',
              'auth:attempt_claim_ip:::1',
              'auth:attempt_claim_ip:unknown',
            ],
          },
        });
      }
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
          await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
        }
      };
      const resultUrl = new RegExp(`/en/quiz/${fixture.quizSlug}/result\\?attemptId=`);

      await login(page, fixture.regular);
      await page.goto(`/en/quiz/${fixture.quizSlug}`);
      await chooseOption(page, 'This answer is intentionally incorrect');
      await submitQuiz();
      await page.waitForURL(resultUrl);

      const source = await fixture.db.collection('attempts').findOne({
        quiz: fixture.quizId,
        user: fixture.regular.id,
      });
      expect(source).toMatchObject({ score: 0, totalQuestions: 1 });
      const sourceId = String(source?._id);

      // AC2: the primary action and the explicit review choice render with the result
      // (RIN-1362). "No thanks" hides it for 7 days, stored server-side, no consent event.
      const remind = page.getByRole('button', { name: 'Remind me in 2 days', exact: true });
      const decline = page.getByRole('button', { name: 'No thanks', exact: true });
      await expect(remind).toBeVisible();
      await expect(decline).toBeVisible();
      await expect(remind).not.toBeFocused();
      await decline.click();
      await expect(decline).toBeHidden();
      await expect
        .poll(async () => {
          const preference = await fixture.db
            .collection('marketingpreferences')
            .findOne({ userId: fixture.regular.id });
          const until = preference?.['reviewPromptSnoozedUntil'] as Date | undefined;
          return until ? Math.round((until.getTime() - Date.now()) / 86_400_000) : null;
        })
        .toBe(7);
      expect(
        await fixture.db
          .collection('marketingconsentevents')
          .countDocuments({ userId: fixture.regular.id }),
      ).toBe(0);
      await Promise.all([
        page.waitForURL(new RegExp(`/en/quiz/${fixture.quizSlug}\\?retryOf=${sourceId}`)),
        page.getByRole('link', { name: 'Retry the 1 you missed', exact: true }).click(),
      ]);

      await expect(
        page.getByText('Retry: 1 question', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await chooseOption(page, 'Production is the correct choice');
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

  test('plays a quick round of 10 on a long quiz and offers Another 10 @critical-quiz', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const longQuizId = new ObjectId();
      const longSlug = `${fixture.quizSlug}-long`;
      const now = new Date();
      // More than 15 questions, so the quiz offers a quick round (RIN-933).
      await fixture.db.collection('quizzes').insertOne({
        _id: longQuizId,
        _e2eRun: fixture.runId,
        author: fixture.regular.id,
        createdAt: now,
        questions: Array.from({ length: 16 }, (_, index) => ({
          _id: new ObjectId(),
          correctIndex: 0,
          options: [`Right answer ${index + 1}`, `Wrong answer ${index + 1}`],
          question: `Long fixture question ${index + 1}?`,
          type: 'single',
        })),
        slug: longSlug,
        title: 'Production Long Quiz',
        updatedAt: now,
        visibility: 'public',
      });

      try {
        await login(page, fixture.regular);
        await page.goto(`/en/quiz/${longSlug}`);
        // AC1: a long quiz offers the choice.
        await expect(
          page.getByRole('button', { name: 'Quick round: 10 questions (~3 min)', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Full quiz (16 questions)', exact: true }),
        ).toBeVisible();

        // AC5: the deep link skips the choice and plays 10 questions.
        await page.goto(`/en/quiz/${longSlug}?mode=quick`);
        await expect(
          page.getByText('Quick round', { exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
        await page
          .getByText(/^Right answer \d+$/)
          .filter({ visible: true })
          .first()
          .click();
        const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
        if (isMobile) {
          await page.getByRole('button', { name: /finish \(1\/10 answered\)/i }).click();
        } else {
          for (let step = 0; step < 9; step += 1) {
            await page.getByRole('button', { name: 'Next', exact: true }).click();
          }
          await page.getByRole('button', { name: 'Submit Quiz', exact: true }).click();
        }
        await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
        await page.waitForURL(new RegExp(`/en/quiz/${longSlug}/result\\?attemptId=`));

        // AC3: the quick result and its next step.
        await expect(
          page.getByRole('heading', { level: 1, name: 'Quick round: 1/10' }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'Another 10', exact: true })).toHaveAttribute(
          'href',
          `/en/quiz/${longSlug}?mode=quick`,
        );

        // RIN-1179: "Send to a classmate" on a public quiz copies the share link when
        // the browser has no share sheet (stubbed so every project takes the copy path).
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
          Object.defineProperty(navigator, 'clipboard', {
            value: {
              writeText: async (text: string) => {
                Reflect.set(window, 'rkSharedLink', text);
              },
            },
            configurable: true,
          });
        });
        await page.getByRole('button', { name: 'Send to a classmate', exact: true }).click();
        await expect(page.getByText('Link copied', { exact: true })).toBeVisible();
        const sharedLink = new URL(
          await page.evaluate(() => String(Reflect.get(window, 'rkSharedLink') ?? 'about:blank')),
        );
        expect(sharedLink.pathname).toBe(`/en/quiz/${longSlug}`);
        expect(Object.fromEntries(sharedLink.searchParams)).toEqual({
          utm_source: 'share',
          utm_medium: 'result',
          utm_campaign: 'quiz-share',
          mode: 'quick',
        });

        const attempt = await fixture.db.collection('attempts').findOne({
          quiz: longQuizId,
          user: fixture.regular.id,
        });
        expect(attempt).toMatchObject({ mode: 'quick', totalQuestions: 10 });
        expect(new Set(attempt?.['questionIndices'] as number[]).size).toBe(10);
      } finally {
        await fixture.db.collection('attempts').deleteMany({ quiz: longQuizId });
      }
    });
  });

  test('lands an activation-email click on the starter and tags quiz_completed @critical-quiz-activation-email', async ({
    page,
  }, testInfo) => {
    // RIN-1000 AC1 + AC3, signed in: CTA → starter quiz → complete → entry=activation_email.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      await login(page, fixture.target);
      await recordAnalyticsEvents(page);

      await page.goto(ACTIVATION_CLICK_PATH);
      await expectActivationLanding(page, starterSlug, testInfo);
      // The email is no post-sign-in hand-off: no starter intro.
      await expect(page.getByText('Try a 2-minute quiz to see how Rinkuzu works')).toHaveCount(0);
      await submitStarterQuiz(page, starterSlug);

      await expect
        .poll(() => quizCompletedProperties(page))
        .toMatchObject({ entry: 'activation_email', authenticated: true, score: 100 });
      const starterQuiz = await fixture.db.collection('quizzes').findOne({ slug: starterSlug });
      try {
        const attempt = await fixture.db
          .collection('attempts')
          .findOne({ quiz: starterQuiz?._id, user: fixture.target.id });
        expect(attempt).toMatchObject({ score: 100, totalQuestions: 1 });
      } finally {
        await fixture.db
          .collection('attempts')
          .deleteMany({ quiz: starterQuiz?._id, user: fixture.target.id });
      }
    });
  });

  test('lets a signed-out activation-email click play the starter as a guest @critical-quiz-activation-email', async ({
    page,
  }, testInfo) => {
    // RIN-1000 AC3, guest path: the starter is guest-playable, so it plays before sign-in.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      await recordAnalyticsEvents(page);

      await page.goto(ACTIVATION_CLICK_PATH);
      await expectActivationLanding(page, starterSlug, testInfo);
      await submitStarterQuiz(page, starterSlug);

      await expect
        .poll(() => quizCompletedProperties(page))
        .toMatchObject({ entry: 'activation_email', authenticated: false, score: 100 });
    });
  });

  test('lets a signed-out visitor report a public quiz from its page @critical-quiz-report', async ({
    page,
  }, testInfo) => {
    // RIN-1344: the quiz-level "Report" dialog on the landing of an indexable public quiz.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const reportSlug = `${fixture.quizSlug}-report`;
      const now = new Date();
      await fixture.db.collection('quizzes').insertOne({
        _id: new ObjectId(),
        _e2eRun: fixture.runId,
        // An owner outside the test accounts keeps the quiz indexable, so the landing shows.
        author: new ObjectId(),
        createdAt: now,
        questions: Array.from({ length: 6 }, (_, index) => ({
          _id: new ObjectId(),
          correctIndex: 0,
          options: [`Report fixture answer ${index + 1}`, `Other answer ${index + 1}`],
          question: `Report fixture question ${index + 1}?`,
          type: 'single',
        })),
        slug: reportSlug,
        title: 'Production Report Quiz',
        updatedAt: now,
        visibility: 'public',
      });

      // The report POST is mocked: the flow under test is the dialog, and the
      // route's rate limit and storage have their own tests (RIN-1343).
      const reportBodies: unknown[] = [];
      let reportStatus = 201;
      await page.route(`**/api/quiz/${reportSlug}/report`, async (route) => {
        reportBodies.push(route.request().postDataJSON());
        await route.fulfill(
          reportStatus === 201
            ? { status: 201, json: { success: true, data: { reportId: 'fake-report' } } }
            : {
                status: 429,
                json: {
                  success: false,
                  error: { code: 'rate_limit_exceeded', message: 'Too many reports.' },
                },
              },
        );
      });

      await page.addInitScript(() => {
        window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
      });
      await page.goto(`/en/quiz/${reportSlug}`);
      const reportLink = page.getByRole('button', { name: 'Report', exact: true });
      await reportLink.scrollIntoViewIfNeeded();
      await reportLink.click();

      const dialog = page.getByRole('dialog', { name: 'Report this quiz' });
      await expect(dialog).toBeVisible();
      // The dialog chunk loads on this first click (RIN-1428); focus still moves into it.
      await expect(dialog.getByRole('radio', { name: 'Copyright' })).toBeFocused();
      const submit = dialog.getByRole('button', { name: 'Send report' });
      await expect(submit).toBeDisabled();

      await dialog.getByRole('radio', { name: 'Copyright' }).check();
      await dialog.getByLabel('Details (optional)').fill('Copied from a textbook');
      await dialog.getByLabel('Email to reply to (optional)').fill('not-an-email');
      await expect(dialog.getByText('Enter a valid email address.')).toBeVisible();
      await expect(submit).toBeDisabled();
      await dialog.getByLabel('Email to reply to (optional)').fill('reader@example.com');

      reportStatus = 429;
      await submit.click();
      await expect(dialog.getByRole('alert')).toHaveText('Too many reports, try again later.');

      reportStatus = 201;
      await submit.click();
      await expect(dialog.getByRole('status')).toHaveText("Thanks, we'll review it.");
      expect(reportBodies.at(-1)).toEqual({
        reason: 'copyright',
        details: 'Copied from a textbook',
        email: 'reader@example.com',
      });
    });
  });

  test('plays the starter from the homepage as a guest and claims it on sign-up @critical-quiz-landing', async ({
    page,
  }, testInfo) => {
    // RIN-1178 AC4/AC5: homepage play-first button -> /try -> starter as a guest -> finish
    // -> "Create an account" on the save card -> the attempt belongs to the new account.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      const email = `e2e-landing-${randomUUID().slice(0, 12)}@example.com`;
      let attemptId = '';
      await recordAnalyticsEvents(page);
      try {
        // RIN-1283: the fonts use display: optional, so whether Vina Sans lands within its
        // ~100 ms block period was a race under load, and its wider fallback wraps the hero
        // h1 to 3 lines. Pin the slower case: no webfont, so the hero CTA (not the
        // bottom-CTA copy) must be wholly in the first screen with the fallback font.
        await page.route(/\/_next\/static\/media\/.+\.woff2$/, (route) => route.abort());
        await page.goto('/en');
        const playFirst = page
          .locator('#landing-main-content > section')
          .first()
          .getByRole('link', { name: 'Try a 2-minute quiz, no account' });
        await expect(playFirst).toBeInViewport({ ratio: 1 });
        await expect
          .poll(() =>
            playFirst.evaluate((node) =>
              Object.keys(node).some((key) => key.startsWith('__reactProps$')),
            ),
          )
          .toBe(true);
        // A client-side navigation through the /try redirect: no new `load` event to wait for.
        await playFirst.click();
        await expect(page).toHaveURL(new RegExp(`/en/quiz/${starterSlug}\\?entry=landing$`));
        await expect
          .poll(() => analyticsEventProperties(page, 'landing_cta_clicked'))
          .toMatchObject({ cta: 'play_first', position: 'hero', locale: 'en' });
        await expect
          .poll(() => analyticsEventProperties(page, 'quiz_started'))
          .toMatchObject({ entry: 'landing' });

        await submitStarterQuiz(page, starterSlug);
        await expect
          .poll(() => quizCompletedProperties(page))
          .toMatchObject({ entry: 'landing', authenticated: false, score: 100 });
        const resultUrl = new URL(page.url());
        attemptId = resultUrl.searchParams.get('attemptId') ?? '';

        await page.getByRole('link', { name: 'Create an account' }).first().click();
        await page.waitForURL(/\/en\/register\?callbackUrl=/);
        await page.getByLabel('Email Address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await page.getByLabel('Confirm password').fill(E2E_PASSWORD);
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Create Account', exact: true }).click();
        await expect(page.getByText('Check your email')).toBeVisible();

        // Stands in for the verification link in the email.
        const created = await fixture.db
          .collection('users')
          .findOneAndUpdate({ email }, { $set: { emailVerified: new Date() } });
        const userId = created?.['_id'];
        expect(userId).toBeInstanceOf(ObjectId);
        // RIN-1263: a signup on /en stores `en`, so the activation nudge is in English.
        expect(created?.['locale']).toBe('en');

        const resultPath = `${resultUrl.pathname.replace(/^\/en/, '')}${resultUrl.search}`;
        await page.goto(`/en/login?callbackUrl=${encodeURIComponent(resultPath)}`);
        await page.getByLabel('Email Address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await Promise.all([
          page.waitForURL(new RegExp(`/en/quiz/${starterSlug}/result\\?attemptId=${attemptId}`)),
          page.getByRole('button', { name: 'Sign In', exact: true }).click(),
        ]);
        await expect
          .poll(async () => {
            const attempt = await fixture.db
              .collection('attempts')
              .findOne({ _id: new ObjectId(attemptId) });
            return attempt?.['user']?.toString() ?? null;
          })
          .toBe(String(userId));
      } finally {
        const created = await fixture.db.collection('users').findOne({ email });
        const ownedAttempts = [
          ...(ObjectId.isValid(attemptId) ? [{ _id: new ObjectId(attemptId) }] : []),
          ...(created ? [{ user: created['_id'] }] : []),
        ];
        await Promise.all([
          ownedAttempts.length > 0
            ? fixture.db.collection('attempts').deleteMany({ $or: ownedAttempts })
            : Promise.resolve(),
          fixture.db.collection('auditlogs').deleteMany({ email }),
          fixture.db.collection('auth_rate_limits').deleteMany({
            key: {
              $in: [
                ...ownedCredentialsRateLimitKeys([email]),
                ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
              ],
            },
          }),
          fixture.db.collection('auth_rate_limits').deleteMany({ key: /^auth:register_ip:/ }),
        ]);
        await fixture.db.collection('users').deleteMany({ email });
      }
    });
  });

  test('opens the starter from the /blog quiz card as a guest @critical-quiz-landing', async ({
    page,
  }, testInfo) => {
    // RIN-1258: the /blog index card -> /try?entry=blog -> the starter with entry=blog and
    // no post; a post's card with an unplayable quiz falls back to the starter, keeping post.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      await recordAnalyticsEvents(page);
      await page.goto('/en/blog');
      const start = page.getByTestId('try-quiz-card').getByRole('link', { name: 'Start the quiz' });
      await expect
        .poll(() =>
          start.evaluate((node) =>
            Object.keys(node).some((key) => key.startsWith('__reactProps$')),
          ),
        )
        .toBe(true);
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/en/quiz/${starterSlug}\\?entry=blog$`));
      await expect
        .poll(() => analyticsEventProperties(page, 'landing_cta_clicked'))
        .toMatchObject({ cta: 'play_first', position: 'blog_index', locale: 'en' });

      await page.goto('/en/try?entry=blog&post=fake-post&quiz=no-such-quiz-e2e');
      await expect(page).toHaveURL(
        new RegExp(`/en/quiz/${starterSlug}\\?entry=blog&post=fake-post$`),
      );
    });
  });

  test('claims a guest result when the verification link opens in another browser @critical-quiz-guest-claim-cross-browser', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    // RIN-1310: the guest's claim token lives in browser A; the email is verified and the
    // learner signs in from browser B. The server claims the attempt at verification.
    // Guest quiz, sign-up, verification and sign-in in two contexts: longer than 30 s.
    testInfo.setTimeout(90_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const starterSlug = await ensureStarterQuiz(fixture.db, new Date());
      const email = `e2e-xbrowser-${randomUUID().slice(0, 12)}@example.com`;
      const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
      let attemptId = '';
      // A fresh context shares nothing with the guest's: no storage, no cookies.
      const other = await browser.newContext({ baseURL: origin });
      try {
        await page.goto(`/en/quiz/${starterSlug}`);
        await submitStarterQuiz(page, starterSlug);
        const resultUrl = new URL(page.url());
        attemptId = resultUrl.searchParams.get('attemptId') ?? '';

        await page.getByRole('link', { name: 'Create an account' }).first().click();
        await page.waitForURL(/\/en\/register\?callbackUrl=/);
        await page.getByLabel('Email Address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await page.getByLabel('Confirm password').fill(E2E_PASSWORD);
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Create Account', exact: true }).click();
        await expect(page.getByText('Check your email')).toBeVisible();

        // The raw token only exists in the email: pin a known one on the pending account.
        const verificationToken = randomUUID().replace(/-/g, '').repeat(2);
        await fixture.db.collection('users').updateOne(
          { email },
          {
            $set: {
              emailVerificationTokenHash: createHash('sha256')
                .update(verificationToken, 'utf8')
                .digest('hex'),
            },
          },
        );

        const otherPage = await other.newPage();
        const verified = await otherPage.request.post('/api/auth/verify-email', {
          data: { token: verificationToken },
          headers: { origin },
        });
        expect(verified.status()).toBe(200);

        const resultPath = `${resultUrl.pathname.replace(/^\/en/, '')}${resultUrl.search}`;
        await otherPage.goto(`/en/login?callbackUrl=${encodeURIComponent(resultPath)}`);
        await otherPage.getByLabel('Email Address').fill(email);
        await otherPage.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await otherPage.getByRole('button', { name: 'Sign In', exact: true }).click();
        // A soft navigation after sign-in: no load event for waitForURL to wait on.
        await expect(otherPage).toHaveURL(
          new RegExp(`/en/quiz/${starterSlug}/result\\?attemptId=${attemptId}`),
          { timeout: 20_000 },
        );
        const user = await fixture.db.collection('users').findOne({ email });
        const attempt = await fixture.db
          .collection('attempts')
          .findOne({ _id: new ObjectId(attemptId) });
        expect(attempt?.['user']?.toString()).toBe(String(user?.['_id']));
        await expect(otherPage.getByRole('link', { name: 'Redo' }).first()).toBeVisible();
        await expect(otherPage.getByText("We couldn't find this")).toHaveCount(0);
        await expect(otherPage.getByText(/can't open the question review/)).toHaveCount(0);
      } finally {
        await other.close();
        const created = await fixture.db.collection('users').findOne({ email });
        const ownedAttempts = [
          ...(ObjectId.isValid(attemptId) ? [{ _id: new ObjectId(attemptId) }] : []),
          ...(created ? [{ user: created['_id'] }] : []),
        ];
        await Promise.all([
          ownedAttempts.length > 0
            ? fixture.db.collection('attempts').deleteMany({ $or: ownedAttempts })
            : Promise.resolve(),
          fixture.db.collection('auditlogs').deleteMany({ email }),
          fixture.db.collection('auth_rate_limits').deleteMany({
            key: {
              $in: [
                ...ownedCredentialsRateLimitKeys([email]),
                ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
              ],
            },
          }),
          fixture.db
            .collection('auth_rate_limits')
            .deleteMany({ key: /^auth:(?:register_ip|verify_email_ip):/ }),
        ]);
        await fixture.db.collection('users').deleteMany({ email });
      }
    });
  });

  test('claims a guest draft when the verification link opens in another browser @critical-quiz-guest-draft-claim', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    // RIN-1447: the guest's own-PDF quiz lives in browser A as a draft token; the email
    // is verified in browser B. The server turns the draft into a public quiz then.
    testInfo.setTimeout(90_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const draft = await seedReadyGuestDraft(fixture.db);
      const email = `e2e-draft-${randomUUID().slice(0, 12)}@example.com`;
      const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
      const other = await browser.newContext({ baseURL: origin });
      try {
        await storeGuestDraftToken(page, draft.token);
        await page.goto('/en/register');
        // A cold load: on WebKit the fills can land before hydration, React Hook Form never
        // sees them and `Create Account` stays disabled. Fill only once React owns the form.
        const emailInput = page.getByLabel('Email Address');
        await expect
          .poll(() =>
            emailInput.evaluate((node) =>
              Object.keys(node).some((key) => key.startsWith('__reactProps$')),
            ),
          )
          .toBe(true);
        await emailInput.fill(email);
        await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
        await page.getByLabel('Confirm password').fill(E2E_PASSWORD);
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Create Account', exact: true }).click();
        await expect(page.getByText('Check your email')).toBeVisible();

        const verificationToken = randomUUID().replace(/-/g, '').repeat(2);
        await fixture.db.collection('users').updateOne(
          { email },
          {
            $set: {
              emailVerificationTokenHash: createHash('sha256')
                .update(verificationToken, 'utf8')
                .digest('hex'),
            },
          },
        );
        const otherPage = await other.newPage();
        const verified = await otherPage.request.post('/api/auth/verify-email', {
          data: { token: verificationToken },
          headers: { origin },
        });
        expect(verified.status()).toBe(200);

        const user = await fixture.db.collection('users').findOne({ email });
        const quiz = await fixture.db
          .collection('quizzes')
          .findOne({ sourceDraftId: draft.apiDraftId });
        expect(quiz).toMatchObject({ author: user?.['_id'], visibility: 'public' });
        expect(
          await fixture.db.collection('guestquizdrafts').countDocuments({ _id: draft.id }),
        ).toBe(0);
        // The quiz now follows the normal public rule: anyone can open it.
        await otherPage.goto(`/en/quiz/${String(quiz?.['slug'])}`);
        await expect(otherPage.getByText(E2E_GUEST_DRAFT_QUESTION)).toBeVisible();

        // RIN-1487: only the verifying browser learns the claimed quiz. Signed in here, the
        // claim finds nothing, so the draft player shows the expired card's library link.
        if (!user) throw new Error('registered user missing');
        await login(page, { email, id: user._id });
        await page.goto('/en/try/pdf/play');
        await expect(
          page.getByRole('heading', { name: GUEST_UPLOAD_COPY.en.expiredTitle }),
        ).toBeVisible();
        await expect(
          page.getByRole('link', { name: GUEST_UPLOAD_COPY.en.library }),
        ).toHaveAttribute('href', '/en/my-quizzes');
      } finally {
        await other.close();
        await cleanupGuestDraft(fixture.db, draft);
        await Promise.all([
          fixture.db.collection('auditlogs').deleteMany({ email }),
          fixture.db.collection('auth_rate_limits').deleteMany({
            key: /^auth:(?:register_ip|verify_email_ip|guest_draft_claim_user|guest_draft_claim_ip):/,
          }),
          fixture.db
            .collection('auth_rate_limits')
            .deleteMany({ key: { $in: [...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS] } }),
        ]);
        await fixture.db.collection('users').deleteMany({ email });
      }
    });
  });

  for (const locale of ['en', 'vi'] as const) {
    test(`opens the quiz the verification claimed from Retake in the verifying browser (${locale}) @critical-quiz-guest-draft-claim`, async ({
      page,
      baseURL,
    }, testInfo) => {
      // RIN-1487: with email/password signup the draft is claimed at verification, so the
      // sign-in claim finds nothing. The verify page remembers the claimed quiz instead.
      testInfo.setTimeout(90_000);
      await withDatabaseFixture(testInfo, async (fixture) => {
        const draft = await seedReadyGuestDraft(fixture.db);
        const email = `e2e-draft-${randomUUID().slice(0, 12)}@example.com`;
        const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
        try {
          await storeGuestDraftToken(page, draft.token);
          // The register form's token hand-off is covered above; here only the verification.
          const registered = await page.request.post('/api/auth/register', {
            data: { email, password: E2E_PASSWORD, guestDraftTokens: [draft.token], locale },
            headers: { origin },
          });
          expect(registered.ok()).toBe(true);

          const verificationToken = randomUUID().replace(/-/g, '').repeat(2);
          await fixture.db.collection('users').updateOne(
            { email },
            {
              $set: {
                emailVerificationTokenHash: createHash('sha256')
                  .update(verificationToken, 'utf8')
                  .digest('hex'),
              },
            },
          );
          await page.goto(`/${locale}/verify-email?token=${verificationToken}`);
          await expect(page.getByText(VERIFY_EMAIL_SUCCESS[locale])).toBeVisible();

          const quiz = await fixture.db
            .collection('quizzes')
            .findOne({ sourceDraftId: draft.apiDraftId });
          const claimedSlug = String(quiz?.['slug']);
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  (
                    JSON.parse(
                      window.localStorage.getItem('rinkuzu.claimedGuestDraft.v1') ?? 'null',
                    ) as { slug?: string } | null
                  )?.slug ?? null,
              ),
            )
            .toBe(claimedSlug);

          const user = await fixture.db.collection('users').findOne({ email });
          if (!user) throw new Error('registered user missing');
          await login(page, { email, id: user._id });
          // Retake on the draft result (its href) and the draft player open the claimed quiz.
          await page.goto(`/${locale}/quiz/guest-draft-play`);
          await expect(page).toHaveURL(new RegExp(`/${locale}/quiz/${claimedSlug}$`));
          await expect(page.getByText(E2E_GUEST_DRAFT_QUESTION)).toBeVisible();
          await page.goto(`/${locale}/try/pdf/play`);
          await expect(page).toHaveURL(new RegExp(`/${locale}/quiz/${claimedSlug}$`));
        } finally {
          await cleanupGuestDraft(fixture.db, draft);
          await Promise.all([
            fixture.db.collection('auditlogs').deleteMany({ email }),
            fixture.db.collection('auth_rate_limits').deleteMany({
              key: /^auth:(?:register_ip|verify_email_ip|guest_draft_claim_user|guest_draft_claim_ip):/,
            }),
            fixture.db
              .collection('auth_rate_limits')
              .deleteMany({ key: { $in: [...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS] } }),
          ]);
          await fixture.db.collection('users').deleteMany({ email });
        }
      });
    });
  }

  test('claims a guest draft the browser holds on email sign-in @critical-quiz-guest-draft-claim', async ({
    page,
  }, testInfo) => {
    // RIN-1447: same browser, existing account: the claimer posts the token after sign-in.
    await withDatabaseFixture(testInfo, async (fixture) => {
      const draft = await seedReadyGuestDraft(fixture.db);
      const authorOf = async () => {
        const quiz = await fixture.db
          .collection('quizzes')
          .findOne({ sourceDraftId: draft.apiDraftId });
        return quiz ? String(quiz['author']) : null;
      };
      try {
        await storeGuestDraftToken(page, draft.token);
        await login(page, fixture.target);
        await expect.poll(authorOf, { timeout: 15_000 }).toBe(fixture.target.id.toHexString());
        await expect
          .poll(() => page.evaluate(() => window.localStorage.getItem('rinkuzu.guestDrafts.v1')))
          .toBeNull();
        expect(
          await fixture.db.collection('guestquizdrafts').countDocuments({ _id: draft.id }),
        ).toBe(0);
      } finally {
        await cleanupGuestDraft(fixture.db, draft);
        await fixture.db.collection('auth_rate_limits').deleteMany({
          key: {
            $in: [
              `auth:guest_draft_claim_user:${fixture.target.id.toHexString()}`,
              ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
            ],
          },
        });
      }
    });
  });

  for (const locale of ['en', 'vi'] as const) {
    test(`uploads a PDF signed out, plays it and claims it on sign-in (${locale}) @critical-quiz-guest-draft-upload`, async ({
      page,
    }, testInfo) => {
      // RIN-1448: the upload call is answered in the browser with a ready draft seeded under
      // the page's own token (no OCR in e2e); play, attempt, result and claim are real.
      await withDatabaseFixture(testInfo, async (fixture) => {
        const copy = GUEST_UPLOAD_COPY[locale];
        const seeded: { draft?: SeededGuestDraft } = {};
        await page.addInitScript(() => {
          window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
        });
        await page.route('**/api/guest-drafts', async (route) => {
          const token = route.request().headers()['x-guest-draft-token'] ?? '';
          seeded.draft = await seedReadyGuestDraft(fixture.db, token);
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: READY_GUEST_DRAFT_BODY,
          });
        });
        const authorOf = async () => {
          const apiDraftId = seeded.draft?.apiDraftId;
          if (!apiDraftId) return null;
          const quiz = await fixture.db
            .collection('quizzes')
            .findOne({ sourceDraftId: apiDraftId });
          return quiz ? String(quiz['author']) : null;
        };
        try {
          // Signed out, no redirect to sign-in.
          await page.goto(`/${locale}/try/pdf?entry=landing`);
          await expect(page).toHaveURL(new RegExp(`/${locale}/try/pdf\\?entry=landing$`));
          // A file set before hydration lands in the server-rendered input with no React
          // handler attached, so the create button never enables (flaked on PR #456).
          const fileInput = page.locator('input[type="file"]');
          await expect
            .poll(() =>
              fileInput.evaluate((node) =>
                Object.keys(node).some((key) => key.startsWith('__reactProps$')),
              ),
            )
            .toBe(true);
          await fileInput.setInputFiles({
            name: 'fake-notes.pdf',
            mimeType: 'application/pdf',
            buffer: await fakeOnePagePdf(),
          });
          await page.getByRole('button', { name: copy.create, exact: true }).click();

          await page.waitForURL(new RegExp(`/${locale}/try/pdf/play$`));
          await expect(page.getByText(copy.notice)).toBeVisible();
          await expect(page.getByText(E2E_GUEST_DRAFT_QUESTION)).toBeVisible();
          await finishOneQuestionQuiz(page, copy);
          await page.waitForURL(new RegExp(`/${locale}/quiz/guest-draft-play/result\\?attemptId=`));
          await expect(page.getByRole('heading', { name: copy.saveTitle })).toBeVisible();

          // Signing in claims the draft into the account (RIN-1447).
          await login(page, fixture.target);
          await expect.poll(authorOf, { timeout: 15_000 }).toBe(fixture.target.id.toHexString());
          // Both claim calls are done (each clears its store last), so the claim's progress
          // write has landed before the fixture cleanup counts the learner's progress.
          await expect
            .poll(
              () =>
                page.evaluate(() => [
                  window.localStorage.getItem('rinkuzu.guestDrafts.v1'),
                  window.localStorage.getItem('rinkuzu.guestClaims.v1'),
                ]),
              { timeout: 15_000 },
            )
            .toEqual([null, null]);

          // RIN-1485: Retake on the draft result (its href) opens the claimed quiz in the
          // signed-in player, not the expired card.
          const claimedQuiz = await fixture.db
            .collection('quizzes')
            .findOne({ sourceDraftId: seeded.draft?.apiDraftId });
          const claimedSlug = String(claimedQuiz?.['slug']);
          await page.goto(`/${locale}/quiz/guest-draft-play`);
          await expect(page).toHaveURL(new RegExp(`/${locale}/quiz/${claimedSlug}$`));
          await expect(page.getByText(E2E_GUEST_DRAFT_QUESTION)).toBeVisible();

          // Without the claimed quiz, a signed-in visitor's expired card points to the library.
          await page.evaluate(() => window.localStorage.removeItem('rinkuzu.claimedGuestDraft.v1'));
          await page.goto(`/${locale}/try/pdf/play`);
          await expect(page.getByRole('heading', { name: copy.expiredTitle })).toBeVisible();
          await expect(page.getByRole('link', { name: copy.library })).toHaveAttribute(
            'href',
            `/${locale}/my-quizzes`,
          );
        } finally {
          if (seeded.draft) await cleanupGuestDraft(fixture.db, seeded.draft);
          await fixture.db.collection('auth_rate_limits').deleteMany({
            key: {
              $in: [
                `auth:guest_draft_claim_user:${fixture.target.id.toHexString()}`,
                ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS,
              ],
            },
          });
        }
      });
    });
  }

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
      // RIN-988: the starter is the single primary CTA. No duplicate quiz
      // button in the hero, and no empty "Continue Learning" card.
      await expect(page.getByTestId('home-hero-cta')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Continue Learning' })).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Or personalize learning by uploading a PDF' }),
      ).toHaveAttribute('href', '/en/adaptive');
      // The email-choices card is in the page flow, never fixed over the cards.
      const emailChoices = page.getByTestId('marketing-prompt-inline');
      if ((await emailChoices.count()) > 0) {
        await expect(emailChoices).not.toHaveCSS('position', 'fixed');
      }
      await expect(page.getByTestId('marketing-prompt-docked')).toHaveCount(0);

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
      await chooseOption(page, 'The starter card');

      const desktopSubmit = page.getByRole('button', { name: 'Submit Quiz', exact: true });
      if (await desktopSubmit.isVisible()) {
        await desktopSubmit.click();
      } else {
        await page.getByRole('button', { name: /finish \(1\/1 answered\)/i }).click();
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

      // The English UI asks the API for English material on upload and session start (RIN-1267).
      const forwarded = await request.post('http://127.0.0.1:8000/__e2e/locales', {
        data: { userId: fixture.regular.id.toHexString() },
        headers: { 'x-e2e-control-token': E2E_CONTROL_TOKEN },
      });
      expect((await forwarded.json()).data).toEqual({ process: 'en', createSession: 'en' });
    });
  });

  test('offers the 2-day review on the adaptive end screen to a signed-in learner @critical-adaptive', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      const sessionId = `e2e-review-${fixture.runId}`;
      const outcome = {
        version: 1,
        result: {
          is_correct: true,
          correct_option: 'A',
          explanation: 'Fake explanation.',
          concept_name: 'Fake concept',
          bloom_level: 1,
          mastery_after: 0.6,
          avg_mastery: 0.5,
          step: 5,
          session_completed: true,
          stats: { total_correct: 4, total_answered: 5, accuracy: 0.8 },
        },
        exercise: {
          id: 'e2e-exercise-5',
          exercise_id: 'e2e-exercise-5',
          concept_name: 'Fake concept',
          concept_idx: 0,
          bloom_level: 1,
          bloom_label: 'Remember',
          exercise_type: 'mcq',
          question: 'Fake question?',
          options: { A: 'Fake answer', B: 'Other fake answer' },
          items: [],
          pairs: [],
          right_items: [],
          step: 5,
          max_steps: 5,
        },
        answer: { type: 'mcq', selection: 'A' },
      };
      await login(page, fixture.regular);
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
        `al_session_outcome:v1:${sessionId}`,
        JSON.stringify(outcome),
      ] as const);
      await page.goto(`/en/adaptive/result/${sessionId}`);

      // The fake API reports a completion an hour ago, so the prompt shows (RIN-1364).
      await expect(page.getByText('Session Complete!')).toBeVisible();
      await expect(
        page.getByText('Want a reminder in 2 days to review what you just studied?'),
      ).toBeVisible();
      // "Remind me" needs SUPPORT_MAIL_FROM, which the e2e environment lacks; the opt-in
      // rows are covered by unit tests. "No thanks" snoozes the prompt with no consent event.
      const remind = page.getByRole('button', { name: 'Remind me in 2 days', exact: true });
      const decline = page.getByRole('button', { name: 'No thanks', exact: true });
      await expect(remind).toBeVisible();
      await decline.click();
      await expect(decline).toBeHidden();
      await expect
        .poll(async () => {
          const preference = await fixture.db
            .collection('marketingpreferences')
            .findOne({ userId: fixture.regular.id });
          return preference?.['reviewPromptSnoozedUntil'] instanceof Date;
        })
        .toBe(true);
      expect(
        await fixture.db
          .collection('marketingconsentevents')
          .countDocuments({ userId: fixture.regular.id }),
      ).toBe(0);
    });
  });

  test('shows a not-found state for an unknown learning session @critical-adaptive', async ({
    page,
  }, testInfo) => {
    await withDatabaseFixture(testInfo, async (fixture) => {
      await login(page, fixture.regular);
      await page.goto('/en/adaptive/subject/e2e-unknown-session');

      await expect(page.getByText("We couldn't find this learning session.")).toBeVisible();
      await expect(page.getByRole('button', { name: /Start Learning/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'Back to Dashboard' }).click();
      await page.waitForURL(/\/en\/adaptive\/?(?:[?#]|$)/);
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

  test('shows a quiz-page copyright report first and hides the quiz from it @critical-admin-quiz-report-hide', async ({
    page,
  }, testInfo) => {
    // RIN-1344: reason, source and the pending hold count on /admin/reports, then Hide quiz.
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const title = `E2E Reported ${fixture.runId}`;
      await fixture.db
        .collection('quizzes')
        .updateOne({ _id: fixture.quizId }, { $set: { title } });
      const now = new Date();
      const reportId = new ObjectId();
      await fixture.db.collection('reports').insertOne({
        _id: reportId,
        _e2eRun: fixture.runId,
        quizId: fixture.quizId.toHexString(),
        quizTitle: title,
        quizSlug: fixture.quizSlug,
        reason: 'copyright',
        source: 'quiz_page',
        content: 'Copied from a textbook',
        ipHash: 'e2e-fake-ip-hash',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      try {
        await login(page, fixture.admin);
        await page.goto('/en/admin/reports');
        await expect(page.getByRole('heading', { name: 'Quiz Reports' })).toBeVisible();
        await expect(page.getByText(/^[1-9]\d* pending copyright \/ personal-data$/)).toBeVisible();

        const reasons = page.getByRole('group', { name: 'Filter by reason' });
        await reasons.getByRole('button', { name: 'Copyright', exact: true }).click();
        const card = page
          .locator('div.p-6')
          .filter({ has: page.getByRole('heading', { name: title }) });
        await expect(card).toHaveCount(1);
        await expect(card.getByText('Quiz page', { exact: true })).toBeVisible();
        await expect(card.getByText('Copyright', { exact: true })).toBeVisible();

        await card.getByRole('button', { name: 'Hide quiz', exact: true }).click();
        const confirm = page.getByRole('dialog', { name: 'Hide quiz' });
        await expect(confirm).toContainText(title);
        await confirm.getByRole('button', { name: 'Hide quiz', exact: true }).click();
        await expect(confirm).toBeHidden();

        await expect
          .poll(
            async () =>
              (await fixture.db.collection('reports').findOne({ _id: reportId }))?.['status'],
          )
          .toBe('resolved');
        const hidden = await fixture.db.collection('quizzes').findOne({ _id: fixture.quizId });
        expect(hidden?.['visibility']).toBe('personal');
      } finally {
        await fixture.db.collection('reports').deleteMany({ _e2eRun: fixture.runId });
      }
    });
  });

  test('filters flagged quizzes and clears a personal-data flag with an audit entry @critical-admin-quiz-personal-data-flag', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      const quizHexId = fixture.quizId.toHexString();
      const title = `E2E Personal Data ${fixture.runId}`;
      await fixture.db.collection('quizzes').updateOne(
        { _id: fixture.quizId },
        {
          $set: {
            title,
            contentFlags: { personalData: true, kinds: ['phone'], checkedAt: new Date() },
          },
        },
      );

      // A plain user may not clear a flag (RIN-1342); the cookie-less context is anonymous.
      const anonymousClear = await request.post(
        `/api/admin/quizzes/${quizHexId}/clear-personal-data-flag`,
        { headers: { 'Sec-Fetch-Site': 'same-origin' } },
      );
      expect(anonymousClear.status()).toBe(401);

      await login(page, fixture.admin);
      await page.goto('/en/admin/quizzes');
      await expect(page.getByRole('heading', { name: 'Quiz Management' })).toBeVisible();
      await page.getByLabel('Content flag').selectOption('personal_data');
      const search = page.getByLabel('Search quizzes...');
      await search.fill(title);
      await search.press('Enter');
      const row = page.locator('article').filter({ hasText: title });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Personal data: phone');

      await row.getByRole('button', { name: 'Clear flag', exact: true }).click();
      const confirm = page.getByRole('dialog');
      await expect(confirm).toContainText(title);
      await confirm.getByRole('button', { name: 'Clear flag', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Clear flag', exact: true })).toHaveCount(0);
      await expect(row).not.toContainText('Personal data:');

      const cleared = await fixture.db.collection('quizzes').findOne({ _id: fixture.quizId });
      expect(cleared?.['contentFlags']).toMatchObject({ personalData: false, kinds: ['phone'] });
      expect(String(cleared?.['contentFlags']?.['clearedBy'])).toBe(fixture.admin.id.toHexString());

      const audits = await fixture.db
        .collection('adminactionaudits')
        .find({ entityType: 'quiz', entityId: quizHexId })
        .toArray();
      expect(
        audits.map((audit) => ({ action: audit['action'], details: audit['details'] })),
      ).toEqual([
        {
          action: 'quiz.personal_data_flag.cleared',
          details: { slug: fixture.quizSlug, kinds: 'phone' },
        },
      ]);
    });
  });

  test('marks, moves and unmarks a starter quiz from the admin quizzes page @critical-admin-starter-quizzes', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withDatabaseFixture(testInfo, async (fixture) => {
      // A starter must exist already, so the new one lands second and can move up (RIN-1183).
      await ensureStarterQuiz(fixture.db, new Date());
      const title = `E2E Starter ${fixture.runId}`;
      await fixture.db
        .collection('quizzes')
        .updateOne({ _id: fixture.quizId }, { $set: { title } });
      const starterRow = () =>
        fixture.db.collection('starterquizzes').findOne({ quiz: fixture.quizId });

      try {
        await login(page, fixture.admin);
        await page.goto('/en/admin/quizzes');
        const starters = page.getByRole('list', { name: 'Starter quizzes in order' });
        await expect(starters).toBeVisible();

        const search = page.getByLabel('Search quizzes...');
        await search.fill(title);
        await search.press('Enter');
        const row = page.locator('article').filter({ hasText: title });
        await expect(row).toHaveCount(1);

        // Vietnamese, so the /en starter pick of the other specs stays the same.
        await row.getByRole('button', { name: 'Mark as starter', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Language').selectOption('vi');
        await dialog.getByRole('button', { name: 'Mark as starter', exact: true }).click();
        await expect(dialog).toBeHidden();

        const entry = starters.getByRole('listitem').filter({ hasText: title });
        await expect(entry.getByRole('combobox')).toHaveValue('vi');
        await expect(
          row.getByRole('button', { name: 'Mark as starter', exact: true }),
        ).toBeDisabled();
        const marked = await starterRow();
        expect(marked?.['locale']).toBe('vi');
        const markedOrder = Number(marked?.['order']);
        expect(markedOrder).toBeGreaterThan(1);

        await entry.getByRole('button', { name: `Move “${title}” up` }).click();
        await expect
          .poll(async () => Number((await starterRow())?.['order']))
          .toBe(markedOrder - 1);

        await entry.getByRole('button', { name: 'Unmark', exact: true }).click();
        const confirm = page.getByRole('dialog');
        await expect(confirm).toContainText(title);
        await confirm.getByRole('button', { name: 'Unmark', exact: true }).click();
        await expect(entry).toHaveCount(0);
        expect(await starterRow()).toBeNull();

        const audits = await fixture.db
          .collection('adminactionaudits')
          .find({ entityType: 'quiz', entityId: fixture.quizId.toHexString() })
          .sort({ createdAt: 1 })
          .toArray();
        expect(audits.map((audit) => audit['action'])).toEqual([
          'starter_quiz.marked',
          'starter_quiz.reordered',
          'starter_quiz.unmarked',
        ]);
      } finally {
        await fixture.db.collection('starterquizzes').deleteMany({ quiz: fixture.quizId });
      }
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
      // A table row from md up, a card below md (RIN-1021); the hidden layout is out of the a11y tree.
      const row = page
        .getByRole('row')
        .or(page.getByRole('listitem'))
        .filter({ hasText: fixture.target.email });
      const openActions = () => row.getByRole('button', { name: 'Actions', exact: true }).click();
      await expect(row).toHaveCount(1);
      // No horizontal scroll hides the row actions any more (RIN-1021). The mobile card can sit
      // below the fold, so scroll it in vertically while pinning the row's start edge (`inline:
      // 'start'`): actions past a horizontal scroll would still be out of the viewport.
      await row.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'start' }));
      await expect(row.getByRole('button', { name: 'Actions', exact: true })).toBeInViewport();
      await expect(row.getByText('Test account', { exact: true })).toHaveCount(0);

      await openActions();
      await row.getByRole('button', { name: 'Mark as test', exact: true }).click();
      const confirmMark = page.getByRole('dialog');
      await expect(confirmMark).toContainText(fixture.target.email);
      await confirmMark.getByRole('button', { name: 'Mark as test', exact: true }).click();
      await expect(row.getByText('Test account', { exact: true })).toBeVisible();
      await openActions();
      await expect(row.getByRole('button', { name: 'Unmark test', exact: true })).toBeVisible();
      expect(await readFlag()).toBe(true);

      // The menu is still open from the check above.
      await row.getByRole('button', { name: 'Unmark test', exact: true }).click();
      const confirmClear = page.getByRole('dialog');
      await confirmClear.getByRole('button', { name: 'Unmark test', exact: true }).click();
      await openActions();
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
