import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './support/fixture-identifiers';

/**
 * /profile must stay put while the SessionProvider polls (RIN-676).
 *
 * SingleSessionGuard checks /api/auth/session every 30 s while the tab is
 * visible and once when it becomes visible again (RIN-687; the SessionProvider
 * poll used to do it every 5 s, two GETs per tick). The profile page used to key
 * its fetch on that object and its tab on a React key, so every poll and every
 * tab click refetched /api/user/profile, flashed the skeleton and threw away
 * what the learner had typed.
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const PROFILE_ROUTE = '/api/user/profile';
const SESSION_ROUTE = '/api/auth/session';
const SESSION_CHECK_INTERVAL_MS = 30_000;
const DEEP_LINK_TABS = [
  { tab: 'overview', name: 'Overview' },
  { tab: 'personal', name: 'Personal' },
  { tab: 'plan', name: 'Plan and quota' },
  { tab: 'security', name: 'Security' },
  { tab: 'email', name: 'Email preferences' },
] as const;

type SeededUser = { email: string; id: ObjectId };

function requireCiDatabase(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for profile E2E flows');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || databaseName !== 'rinkuzu_ci') {
    throw new Error('Profile E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci');
  }
  return { databaseName, uri };
}

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

async function withLearner(testInfo: TestInfo, run: (learner: SeededUser) => Promise<void>) {
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
      displayName: 'E2E Profile Learner',
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
    await run(learner);
  } finally {
    try {
      await Promise.all([
        db.collection('auditlogs').deleteMany({
          $or: [{ userId: learner.id }, { email: learner.email }],
        }),
        db
          .collection('auth_rate_limits')
          .deleteMany({ key: credentialsRateLimitKey(learner.email) }),
      ]);
      await db.collection('users').deleteMany({ _e2eRun: runId });
      const remaining = await db.collection('users').countDocuments({ _e2eRun: runId });
      if (remaining !== 0) throw new Error(`Profile E2E cleanup left ${remaining} users`);
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
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard(?:[/?#]|$)/),
    page.getByRole('button', { name: 'Sign In', exact: true }).click(),
  ]);
}

/** Counts GETs to a path from the moment it is called. */
function countRequests(page: Page, pathname: string): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === pathname) count += 1;
  });
  return () => count;
}

/**
 * Runs one session check to the end: triggers it, waits for its response body
 * and lets the page run the fetch callbacks. The guard skips a tick while a
 * check is still in flight (it never stacks session GETs), so fake time must not
 * reach the next tick before the previous check has finished; on a slow machine
 * `runFor(60_000)` fired both ticks while the first GET was still open (RIN-737).
 */
async function runSessionCheck(page: Page, trigger: () => Promise<unknown>): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'GET' && new URL(candidate.url()).pathname === SESSION_ROUTE,
  );
  await trigger();
  await (await response).finished();
  // One real macrotask (page.clock does not fake MessageChannel), so the
  // guard's `finally` has cleared its in-flight flag before the next tick.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
      }),
  );
}

test.describe('profile page stability', () => {
  test('keeps loaded content and typed input across session polls and tab switches @profile-stability', async ({
    page,
  }, testInfo) => {
    test.slow();
    await withLearner(testInfo, async (learner) => {
      await login(page, learner);

      await page.clock.install();
      const profileRequests = countRequests(page, PROFILE_ROUTE);
      const sessionRequests = countRequests(page, SESSION_ROUTE);
      await page.goto('/en/profile?tab=personal');

      const displayName = page.getByLabel('Display Name');
      await expect(displayName).toHaveValue('E2E Profile Learner');
      await displayName.fill('Typed while polling');

      // One check when the tab becomes visible, then exactly one per 30 s tick.
      const before = sessionRequests();
      await runSessionCheck(page, () =>
        page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))),
      );
      expect(sessionRequests()).toBe(before + 1);
      await runSessionCheck(page, () => page.clock.runFor(SESSION_CHECK_INTERVAL_MS));
      expect(sessionRequests()).toBe(before + 2);
      await runSessionCheck(page, () => page.clock.runFor(SESSION_CHECK_INTERVAL_MS));
      expect(sessionRequests()).toBe(before + 3);
      // No late second GET (broadcast echo or stacked check) after the last tick.
      await page.waitForTimeout(1_000);
      expect(sessionRequests()).toBe(before + 3);

      await expect(displayName).toHaveValue('Typed while polling');
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      expect(profileRequests()).toBe(1);

      await page.getByRole('tab', { name: 'Security', exact: true }).click();
      await expect(page).toHaveURL(/[?&]tab=security\b/);
      await expect(page.getByLabel('Current Password')).toBeVisible();
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await expect(page).toHaveURL(/\/en\/profile$/);
      await page.getByRole('tab', { name: 'Personal', exact: true }).click();
      await expect(page).toHaveURL(/[?&]tab=personal\b/);
      await expect(page.getByLabel('Display Name')).toHaveValue('Typed while polling');
      expect(profileRequests()).toBe(1);

      for (const { tab, name } of DEEP_LINK_TABS) {
        await page.goto(`/en/profile?tab=${tab}`);
        await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      }
    });
  });
});

async function signedInPage(browser: Browser, learner: SeededUser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, learner);
  return page;
}

test.describe('single active session', () => {
  test('a second sign-in signs the first browser out on its next session check @profile-stability', async ({
    browser,
  }, testInfo) => {
    test.slow();
    await withLearner(testInfo, async (learner) => {
      const first = await signedInPage(browser, learner);
      await first.clock.install();
      await first.goto('/en/profile?tab=personal');
      await expect(first.getByLabel('Display Name')).toBeVisible();
      // The first tab is already open when the learner signs in elsewhere; the
      // server would refuse any new navigation, so only the guard's next timed
      // check can notice (no focus event, so SWR revalidation stays out of it).
      const second = await signedInPage(browser, learner);
      try {
        await first.clock.runFor(SESSION_CHECK_INTERVAL_MS);
        await expect(first.getByText(/signed in somewhere else/)).toBeVisible();
        await first.clock.runFor(2_000);
        await first.waitForURL(/\/en\/login(?:[/?#]|$)/, { timeout: 15_000 });

        await second.goto('/en/profile');
        await expect(second).toHaveURL(/\/en\/profile$/);
      } finally {
        await first.context().close();
        await second.context().close();
      }
    });
  });
});
