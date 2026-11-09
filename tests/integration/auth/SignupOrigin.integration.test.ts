import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1268: the signup origin is stored at creation and never overwritten. */
describe('AuthAccountRepository signup origin integration', () => {
  const repo = new AuthAccountRepository();
  const stamp = Date.now();
  const credentialsEmail = `origin-a-${stamp}@example.test`;
  const googleEmail = `origin-b-${stamp}@example.test`;
  const emails = [credentialsEmail, googleEmail];
  const users = () => mongoose.connection.collection('users');

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await users().deleteMany({ email: { $in: emails } });
    await mongoose.disconnect();
  }, 10_000);

  it('stores the origin of a credentials signup, a null country included', async () => {
    const created = await repo.createPending({
      email: credentialsEmail,
      passwordHash: 'fake-hash',
      verificationTokenHash: 'fake-verify-hash',
      verificationExpires: new Date(Date.now() + 86_400_000),
      signupOrigin: { signupLocale: 'en', signupCountry: null },
    });
    expect(created).not.toBeNull();
    const doc = await users().findOne({ email: credentialsEmail });
    expect(doc).toMatchObject({ signupLocale: 'en', signupCountry: null });
  });

  it('records a Google signup origin once and never overwrites it', async () => {
    const google = await repo.resolveVerifiedGoogleAccount({
      subject: `fake-google-${stamp}`,
      email: googleEmail,
      now: new Date(),
      ip: null,
    });
    if (!google) throw new Error('Google account was not created');
    expect(google.isNewAccount).toBe(true);
    const id = google.id;

    await repo.recordSignupOriginIfMissing(id, { signupLocale: 'vi', signupCountry: 'VN' });
    await repo.recordSignupOriginIfMissing(id, { signupLocale: 'en', signupCountry: 'US' });

    const doc = await users().findOne({ email: googleEmail });
    expect(doc).toMatchObject({ signupLocale: 'vi', signupCountry: 'VN' });
  });
});
