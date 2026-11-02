import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './support/fixture-identifiers';

/**
 * The admin Personalized Learning workspace on /admin/stats (RIN-399 AC 7).
 *
 * The page, its BFF route and the admin gate run for real; the adaptive API
 * behind the route is `support/fake-personal-learning.mjs`, which answers each
 * window with its own aggregate counts. The only rows seeded are the two
 * accounts that sign in, and no learner data is read or asserted on.
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';
const SUMMARY_ROUTE = '/api/admin/personal-learning/summary';

/** What the fake service returns per window, as the page words it. */
const WINDOW_FIGURES = [
  { label: '7 days', key: '7d', jobs: '3 of 4', period: '2026-10-28' },
  { label: '30 days', key: '30d', jobs: '9 of 12', period: '2026-10-19' },
  { label: '90 days', key: '90d', jobs: '31 of 40', period: '2026-09-30' },
  { label: 'All time', key: 'all', jobs: '97 of 120', period: '2026-10' },
] as const;

type SeededUser = { email: string; id: ObjectId };
type Fixture = { admin: SeededUser; db: Db; regular: SeededUser };

function requireCiDatabase(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for admin E2E flows');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || databaseName !== 'rinkuzu_ci') {
    throw new Error('Admin E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci');
  }
  return { databaseName, uri };
}

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

async function withAccounts(testInfo: TestInfo, run: (fixture: Fixture) => Promise<void>) {
  const { databaseName, uri } = requireCiDatabase();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);
  const runId = `${testInfo.project.name}-${randomUUID()}`;
  const admin = { id: new ObjectId(), email: createE2EUserEmail('admin', runId) };
  const regular = { id: new ObjectId(), email: createE2EUserEmail('regular', runId) };
  const emails = [admin.email, regular.email];

  try {
    const password = await hash(E2E_PASSWORD, 4);
    const now = new Date();
    await db.collection('users').insertMany(
      [
        { ...admin, displayName: 'E2E Admin User', role: 'admin' },
        { ...regular, displayName: 'E2E Regular User', role: 'user' },
      ].map(({ id, ...user }) => ({
        _id: id,
        ...user,
        _e2eRun: runId,
        authVersion: 0,
        createdAt: now,
        disable: 0,
        disabledAt: null,
        disabledBy: null,
        emailVerified: now,
        failedLoginAttempts: 0,
        password,
      })),
    );
    await run({ admin, db, regular });
  } finally {
    try {
      await Promise.all([
        db.collection('auditlogs').deleteMany({
          $or: [{ userId: { $in: [admin.id, regular.id] } }, { email: { $in: emails } }],
        }),
        db
          .collection('auth_rate_limits')
          .deleteMany({ key: { $in: emails.map(credentialsRateLimitKey) } }),
      ]);
      await db.collection('users').deleteMany({ _e2eRun: runId });
      const remaining = await db.collection('users').countDocuments({ _e2eRun: runId });
      if (remaining !== 0) throw new Error(`Admin E2E cleanup left ${remaining} users`);
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

function summaryResponse(page: Page, key: string) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`${SUMMARY_ROUTE}?window=${key}`) &&
      response.request().method() === 'GET',
  );
}

test.describe('admin personal-learning dashboard', () => {
  test('renders aggregate totals and trend, and refetches per window @critical-admin-personal-learning', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withAccounts(testInfo, async ({ admin }) => {
      await login(page, admin);
      await page.goto('/en/admin/stats');

      const initial = summaryResponse(page, '30d');
      await page
        .getByRole('navigation', { name: 'Statistics workspace' })
        .getByRole('button', { name: 'Personalized Learning' })
        .click();
      expect((await initial).status()).toBe(200);

      await expect(
        page.getByRole('heading', { name: 'Personalized Learning', exact: true }),
      ).toBeVisible();
      const filter = page.getByRole('group', { name: 'Time window' });
      await expect(filter.getByRole('button', { name: '30 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByText('Active learners', { exact: true }).first()).toBeVisible();
      const chart = page.getByRole('img', { name: 'Trend over time' });
      await expect(chart).toBeVisible();

      for (const figures of WINDOW_FIGURES) {
        const jobsDetail = `${figures.jobs} jobs started in this window completed`;
        if (figures.key !== '30d') {
          const refetch = summaryResponse(page, figures.key);
          await filter.getByRole('button', { name: figures.label }).click();
          expect((await refetch).status()).toBe(200);
          await expect(filter.getByRole('button', { name: figures.label })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
        }
        await expect(page.getByText(jobsDetail)).toBeVisible();
        await expect(chart.getByText(figures.period, { exact: true })).toBeVisible();
        for (const other of WINDOW_FIGURES.filter((entry) => entry !== figures)) {
          await expect(
            page.getByText(`${other.jobs} jobs started in this window completed`),
          ).toHaveCount(0);
        }
      }
    });
  });

  test('keeps non-admins and anonymous visitors out @critical-admin-personal-learning-gate', async ({
    page,
  }, testInfo) => {
    await withAccounts(testInfo, async ({ regular }) => {
      await page.goto('/en/admin/stats');
      await expect(page).toHaveURL(/\/en\/login\?(?:.*&)?callbackUrl=%2Fadmin%2Fstats/);
      const anonymousApi = await page.request.get(`${SUMMARY_ROUTE}?window=30d`);
      expect(anonymousApi.status()).toBe(401);

      await login(page, regular);
      await page.goto('/en/admin/stats');
      // The proxy sends non-admin users to localized home; an authenticated
      // home page then canonicalizes to dashboard by design.
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);
      await expect(
        page.getByRole('heading', { name: 'Personalized Learning', exact: true }),
      ).toHaveCount(0);

      const forbidden = await page.evaluate(async (route) => {
        const response = await fetch(`${route}?window=30d`);
        return { body: await response.json(), status: response.status };
      }, SUMMARY_ROUTE);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toMatchObject({ error: { code: 'forbidden' }, success: false });
    });
  });
});
