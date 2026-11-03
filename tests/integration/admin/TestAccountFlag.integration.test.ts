import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { AdminActionAudit } from '@/models/Communication';
import { integrationDatabaseUri } from '../../setup/integration-db';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import { PATCH } from '@/app/api/admin/users/[userId]/test-account/route';

describe('admin test-account flag integration', () => {
  const adminId = new Types.ObjectId();
  const learnerId = new Types.ObjectId();
  const runId = `test-account-${learnerId.toHexString()}`;
  const users = () => mongoose.connection.collection('users');

  function patch(isTestAccount: boolean) {
    const request = new NextRequest(
      `http://localhost/api/admin/users/${learnerId.toHexString()}/test-account`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isTestAccount }),
      },
    );
    return PATCH(request, { params: Promise.resolve({ userId: learnerId.toHexString() }) });
  }

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    // No `isTestAccount` field at all, like every account created before the flag existed.
    await users().insertOne({
      _id: learnerId,
      _integrationRun: runId,
      email: `${runId}@learners.fixture`,
      role: 'user',
      disable: 0,
      authVersion: 0,
      createdAt: new Date(),
    });
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await users().deleteMany({ _integrationRun: runId });
    await AdminActionAudit.deleteMany({ entityId: learnerId.toHexString() });
    await mongoose.disconnect();
  }, 10_000);

  beforeEach(() => {
    authMock.mockResolvedValue({
      user: { id: adminId.toHexString(), email: 'admin@example.test', role: 'admin' },
    });
  });

  it('sets, re-sets and clears the flag with exactly one audit entry per real change', async () => {
    const set = await patch(true);
    expect(set.status).toBe(200);
    await expect(set.json()).resolves.toMatchObject({
      data: { isTestAccount: true, changed: true },
    });
    expect(await users().findOne({ _id: learnerId })).toMatchObject({ isTestAccount: true });

    const again = await patch(true);
    expect(again.status).toBe(200);
    await expect(again.json()).resolves.toMatchObject({ data: { changed: false } });

    expect((await patch(false)).status).toBe(200);
    expect(await users().findOne({ _id: learnerId })).toMatchObject({ isTestAccount: false });

    const audits = await AdminActionAudit.find({ entityId: learnerId.toHexString() })
      .sort({ _id: 1 })
      .lean();
    expect(audits.map((entry) => entry.details)).toEqual([
      { isTestAccount: 'true', previous: 'false' },
      { isTestAccount: 'false', previous: 'true' },
    ]);
    for (const entry of audits) {
      expect(String(entry.actorId)).toBe(adminId.toHexString());
      expect(entry).toMatchObject({
        action: 'user.test_account.set',
        entityType: 'user',
      });
      expect(JSON.stringify(entry.details)).not.toContain('@');
    }
  });

  it('refuses non-admins without touching the flag', async () => {
    authMock.mockResolvedValue({
      user: { id: adminId.toHexString(), email: 'user@example.test', role: 'user' },
    });
    const before = await users().findOne({ _id: learnerId });

    expect((await patch(true)).status).toBe(403);
    expect(await users().findOne({ _id: learnerId })).toEqual(before);
  });
});
