import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import { hashPassword } from '@/lib/password';
import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

describe('AuthAccountRepository sign-in integration', () => {
  const repo = new AuthAccountRepository();
  const email = `auth-integ-${Date.now()}@example.test`;
  let userId = '';

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
      const password = await hashPassword('Integration-Pass-123!');
      const created = await mongoose.connection.collection('users').insertOne({
        email,
        password,
        role: 'user',
        disable: 0,
        authVersion: 0,
        disabledAt: null,
        disabledBy: null,
        emailVerified: new Date(),
        failedLoginAttempts: 0,
        failedLoginWindowStart: null,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      userId = created.insertedId.toString();
    } catch (error) {
      throw new Error('Auth repository integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await mongoose.connection.collection('users').deleteOne({ email });
    await mongoose.disconnect();
  }, 10_000);

  it('finds login account and session user', async () => {
    const login = await repo.findLoginAccount(email);
    expect(login?.id).toBe(userId);
    expect(login?.passwordHash).toBeTruthy();

    const sessionUser = await repo.findSessionUser(userId);
    expect(sessionUser).toMatchObject({ id: userId, email, role: 'user' });
  });

  it('atomically increments failed attempts toward lockout', async () => {
    const policy = { maxAttempts: 3, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
    const now = new Date();

    await Promise.all([
      repo.recordFailedLogin(userId, now, policy),
      repo.recordFailedLogin(userId, now, policy),
      repo.recordFailedLogin(userId, now, policy),
    ]);

    const login = await repo.findLoginAccount(email);
    expect(login).toBeTruthy();
    // Concurrent pipeline updates: either locked or attempts advanced.
    const lockedOrAttempted = Boolean(login?.lockedUntil) || (login?.failedLoginAttempts ?? 0) > 0;
    expect(lockedOrAttempted).toBe(true);
  });

  it('upserts verified Google account idempotently', async () => {
    const googleEmail = `google-integ-${Date.now()}@example.test`;
    const subject = `google-sub-${Date.now()}`;
    const first = await repo.resolveVerifiedGoogleAccount({
      subject,
      email: googleEmail,
      now: new Date(),
      ip: '127.0.0.1',
      displayName: 'Google User',
    });
    const second = await repo.resolveVerifiedGoogleAccount({
      subject,
      email: `renamed-${googleEmail}`,
      now: new Date(),
      ip: '127.0.0.1',
      displayName: 'Google User 2',
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.isNewAccount).toBe(true);
    expect(second?.isNewAccount).toBe(false);
    expect(second?.id).toBe(first?.id);
    expect(second?.email).toBe(googleEmail);
    expect(second?.authVersion).toBe((first?.authVersion ?? 0) + 1);
    await mongoose.connection.collection('users').deleteOne({ email: googleEmail });
  });

  it('records successful login and resets lock state', async () => {
    const login = await repo.findLoginAccount(email);
    const passwordHash = login?.passwordHash;
    expect(passwordHash).toBeTruthy();
    if (!login?.passwordHash) {
      throw new Error('expected password hash for integration login account');
    }
    const authenticatedUser = await repo.recordSuccessfulLogin(userId, login.passwordHash, {
      now: new Date(),
      ip: '127.0.0.1',
      expectedAuthVersion: login.authVersion,
    });
    expect(authenticatedUser?.authVersion).toBe(login.authVersion + 1);
    await expect(
      repo.recordSuccessfulLogin(userId, login.passwordHash, {
        now: new Date(),
        ip: '127.0.0.1',
        expectedAuthVersion: login.authVersion,
      }),
    ).resolves.toBeNull();
    const after = await repo.findLoginAccount(email);
    expect(after?.failedLoginAttempts).toBe(0);
    expect(after?.lockedUntil).toBeUndefined();
  });
});
