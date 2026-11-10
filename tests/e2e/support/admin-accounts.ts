import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import type { Page, TestInfo } from '@playwright/test';
import { createE2EUserEmail } from './fixture-identifiers';
import { skipPostSignInStarter } from './post-signin';

/**
 * Seeded admin and regular accounts for admin E2E flows, removed again after
 * each flow, plus the credentials login (moved from admin-personal-learning, RIN-846).
 */

const E2E_PASSWORD = 'Rinkuzu-E2E-Password-42!';

type SeededUser = { email: string; id: ObjectId };
type AdminFixture = { admin: SeededUser; db: Db; regular: SeededUser };

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

/**
 * Every E2E login comes from the same loopback IP, so the shared 20-per-15-minutes
 * `credentials_ip` limit is spent across specs and a later admin login sees
 * "Please wait a moment" (PR #387). Each admin flow starts and ends with it cleared,
 * as the critical flows do.
 */
const E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS = [
  'auth:credentials_ip:127.0.0.1',
  'auth:credentials_ip:::1',
  'auth:credentials_ip:unknown',
];

function credentialsRateLimitKey(email: string): string {
  return `auth:credentials_identity:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export async function withAccounts(
  testInfo: TestInfo,
  run: (fixture: AdminFixture) => Promise<void>,
) {
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
    await db
      .collection('auth_rate_limits')
      .deleteMany({ key: { $in: E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS } });
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
        db.collection('auth_rate_limits').deleteMany({
          key: {
            $in: [...emails.map(credentialsRateLimitKey), ...E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS],
          },
        }),
      ]);
      await db.collection('users').deleteMany({ _e2eRun: runId });
      const remaining = await db.collection('users').countDocuments({ _e2eRun: runId });
      if (remaining !== 0) throw new Error(`Admin E2E cleanup left ${remaining} users`);
    } finally {
      await client.close();
    }
  }
}

export async function login(page: Page, user: SeededUser): Promise<void> {
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
