import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { LastActiveAdminError } from '@/entities/AdminMutation';
import { UserRepository } from '@/repositories/UserRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

describe('active-admin mutation fence integration', () => {
  const runId = `admin-fence-${randomUUID()}`;
  const firstAdminId = new Types.ObjectId();
  const secondAdminId = new Types.ObjectId();
  const firstEmail = `${runId}-first@example.test`;
  const secondEmail = `${runId}-second@example.test`;

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
      const now = new Date();
      await mongoose.connection.collection('users').insertMany([
        {
          _id: firstAdminId,
          _integrationRun: runId,
          email: firstEmail,
          role: 'admin',
          disable: 0,
          authVersion: 0,
          disabledAt: null,
          disabledBy: null,
          emailVerified: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: secondAdminId,
          _integrationRun: runId,
          email: secondEmail,
          role: 'admin',
          disable: 0,
          authVersion: 0,
          disabledAt: null,
          disabledBy: null,
          emailVerified: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await mongoose.connection
        .collection<{ _id: string; revision: number; updatedAt: Date }>('adminmutationfences')
        .insertOne({
          _id: 'active-admin',
          revision: 0,
          updatedAt: now,
        });
    } catch (error) {
      throw new Error('Admin mutation replica-set integration database is unavailable', {
        cause: error,
      });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await mongoose.connection.collection('users').deleteMany({ _integrationRun: runId });
    await mongoose.connection
      .collection<{ _id: string }>('adminmutationfences')
      .deleteOne({ _id: 'active-admin' });
    await mongoose.disconnect();
  }, 10_000);

  it('serializes concurrent set-reducing mutations and preserves one active admin', async () => {
    const repository = new UserRepository();
    const outcomes = await Promise.allSettled([
      repository.applyAdminMutation({
        kind: 'disable',
        targetUserId: firstAdminId.toHexString(),
        disable: 1,
        actor: { id: firstAdminId.toHexString(), email: firstEmail },
        now: new Date(),
      }),
      repository.applyAdminMutation({
        kind: 'role',
        targetUserId: secondAdminId.toHexString(),
        role: 'user',
        actor: { id: secondAdminId.toHexString(), email: secondEmail },
      }),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(LastActiveAdminError);

    await expect(
      mongoose.connection.collection('users').countDocuments({ role: 'admin', disable: 0 }),
    ).resolves.toBe(1);
    await expect(
      mongoose.connection
        .collection<{ _id: string; revision: number }>('adminmutationfences')
        .findOne({ _id: 'active-admin' }),
    ).resolves.toMatchObject({ revision: 1 });
  });
});
