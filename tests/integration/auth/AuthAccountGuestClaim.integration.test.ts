import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * RIN-1310: the guest claim hashes stored at sign-up come back exactly once, from the
 * verification that removes them, so the attempt is claimed in whatever browser
 * opened the link.
 */
describe('AuthAccountRepository guest claim hashes', () => {
  const repo = new AuthAccountRepository();
  const stamp = Date.now();
  const emails = [`guest-claim-${stamp}@example.test`, `no-guest-claim-${stamp}@example.test`];

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Auth repository integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await mongoose.connection.collection('users').deleteMany({ email: { $in: emails } });
    await mongoose.disconnect();
  }, 10_000);

  it('returns the stored hashes from the verification and removes them', async () => {
    const [email] = emails as [string, string];
    const account = await repo.createPending({
      email,
      passwordHash: 'fake-password-hash',
      verificationTokenHash: `verify-${stamp}`,
      verificationExpires: new Date(Date.now() + 60_000),
      guestClaimHashes: ['a'.repeat(64), 'b'.repeat(64)],
    });
    expect(account).not.toBeNull();

    const verified = await repo.verifyEmail(`verify-${stamp}`, new Date());

    expect(verified).toMatchObject({
      id: account?.id,
      email,
      guestClaimHashes: ['a'.repeat(64), 'b'.repeat(64)],
    });
    const stored = await mongoose.connection.collection('users').findOne({ email });
    expect(stored).not.toHaveProperty('guestClaimHashes');
    expect(stored?.['emailVerified']).toBeInstanceOf(Date);
    expect(await repo.verifyEmail(`verify-${stamp}`, new Date())).toBeNull();
  });

  it('returns no hashes for an account that stored none', async () => {
    const [, email] = emails as [string, string];
    await repo.createPending({
      email,
      passwordHash: 'fake-password-hash',
      verificationTokenHash: `verify-none-${stamp}`,
      verificationExpires: new Date(Date.now() + 60_000),
    });

    const verified = await repo.verifyEmail(`verify-none-${stamp}`, new Date());

    expect(verified).not.toBeNull();
    expect(verified).not.toHaveProperty('guestClaimHashes');
  });
});
