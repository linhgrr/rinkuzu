import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { EntitlementAccount, EntitlementAdjustment, EntitlementGrant } from '@/models/Billing';
import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import { addCalendarMonths } from '@/services/billing/billing-domain';

const uri = process.env['MONGODB_URI'];
const databaseName = uri ? decodeURIComponent(new URL(uri).pathname.slice(1)) : '';
const isSafeTestDb = /(^|[-_])(test|ci)($|[-_])/i.exec(databaseName) !== null;

if (!uri) {
  throw new Error('MONGODB_URI is required for entitlement ledger integration tests');
}
if (!isSafeTestDb) {
  throw new Error(
    `Refusing integration tests against non-test database: ${databaseName || '<empty>'}`,
  );
}

/**
 * The ledger is the single writer for Premium. Every grant path — billing
 * fulfilment and admin grants — funnels through `appendGrant`, and it can only
 * be exercised against a real replica set because it allocates its sequence
 * inside a transaction. These tests are the regression fence for that writer.
 */
describe('entitlement ledger integration', () => {
  const ledger = new EntitlementLedgerRepository();
  const users: Types.ObjectId[] = [];

  function nextUser(): Types.ObjectId {
    const user = new Types.ObjectId();
    users.push(user);
    return user;
  }

  async function withSession<T>(run: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => run(session));
    } finally {
      await session.endSession();
    }
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Entitlement ledger integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      EntitlementGrant.deleteMany({ user: { $in: users } }),
      EntitlementAdjustment.deleteMany({ user: { $in: users } }),
      EntitlementAccount.deleteMany({ user: { $in: users } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('appends the first grant and projects an active entitlement', async () => {
    const user = nextUser();
    const committedAt = new Date('2026-03-10T08:00:00.000Z');

    const projection = await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt,
        },
        session,
      ),
    );

    expect(projection.perpetual).toBe(false);
    expect(projection.startAt?.toISOString()).toBe(committedAt.toISOString());
    expect(projection.endAt?.toISOString()).toBe(
      addCalendarMonths(committedAt, 1, committedAt.getUTCDate()).toISOString(),
    );

    const grants = await EntitlementGrant.find({ user }).lean<Array<{ sequence: number }>>().exec();
    expect(grants).toHaveLength(1);
    // `EntitlementGrant.sequence` has `min: 1`; sequence 0 fails schema validation.
    expect(grants[0]?.sequence).toBe(1);

    const account = await EntitlementAccount.findOne({ user })
      .lean<{ nextSequence: number; version: number; currentEndAt?: Date }>()
      .exec();
    expect(account?.nextSequence).toBe(2);
    expect(account?.currentEndAt?.toISOString()).toBe(projection.endAt?.toISOString());
  });

  it('is idempotent for a repeated source id', async () => {
    const user = nextUser();
    const sourceId = new Types.ObjectId().toString();
    const input = {
      user,
      sourceType: 'billing_order' as const,
      sourceId,
      planId: 'plan_premium_1m',
      planName: 'Premium 1 tháng',
      durationUnit: 'month' as const,
      durationValue: 1,
      committedAt: new Date('2026-03-10T08:00:00.000Z'),
    };

    const first = await withSession((session) => ledger.appendGrant(input, session));
    const second = await withSession((session) => ledger.appendGrant(input, session));

    expect(second.endAt?.toISOString()).toBe(first.endAt?.toISOString());
    await expect(EntitlementGrant.countDocuments({ user })).resolves.toBe(1);
  });

  it('stacks a renewal onto the live segment instead of restarting it', async () => {
    const user = nextUser();
    const firstCommittedAt = new Date('2026-03-10T08:00:00.000Z');
    const first = await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt: firstCommittedAt,
        },
        session,
      ),
    );

    // Renewal bought while the first month is still live.
    const second = await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt: new Date('2026-03-25T08:00:00.000Z'),
        },
        session,
      ),
    );

    // The window starts where the first grant started and runs two months from
    // that same baseline — the renewal must not lose the unused remainder.
    expect(second.startAt?.toISOString()).toBe(firstCommittedAt.toISOString());
    expect(second.endAt?.toISOString()).toBe(
      addCalendarMonths(firstCommittedAt, 2, firstCommittedAt.getUTCDate()).toISOString(),
    );
    expect(second.endAt?.getTime()).toBeGreaterThan(first.endAt?.getTime() ?? 0);

    const segments = await EntitlementGrant.distinct('segmentId', { user });
    expect(segments).toHaveLength(1);
  });

  it('starts a fresh segment when the previous window already lapsed', async () => {
    const user = nextUser();
    await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt: new Date('2026-01-05T08:00:00.000Z'),
        },
        session,
      ),
    );

    const reactivatedAt = new Date('2026-06-05T08:00:00.000Z');
    const projection = await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt: reactivatedAt,
        },
        session,
      ),
    );

    expect(projection.startAt?.toISOString()).toBe(reactivatedAt.toISOString());
    expect(projection.endAt?.toISOString()).toBe(
      addCalendarMonths(reactivatedAt, 1, reactivatedAt.getUTCDate()).toISOString(),
    );
    const segments = await EntitlementGrant.distinct('segmentId', { user });
    expect(segments).toHaveLength(2);
  });

  it('revokes every grant and clears the projection', async () => {
    const user = nextUser();
    await withSession((session) =>
      ledger.appendGrant(
        {
          user,
          sourceType: 'billing_order',
          sourceId: new Types.ObjectId().toString(),
          planId: 'plan_premium_1m',
          planName: 'Premium 1 tháng',
          durationUnit: 'month',
          durationValue: 1,
          committedAt: new Date(),
        },
        session,
      ),
    );
    const account = await EntitlementAccount.findOne({ user })
      .lean<{ _id: Types.ObjectId }>()
      .exec();
    expect(account).not.toBeNull();

    const revokedUserId = await ledger.revokeAccount(
      String(account?._id),
      `admin_${randomUUID()}`,
      'integration revoke',
    );
    expect(revokedUserId).toBe(user.toString());

    const after = await EntitlementAccount.findOne({ user })
      .lean<{ currentStartAt?: Date; currentEndAt?: Date; perpetual: boolean }>()
      .exec();
    expect(after?.currentStartAt).toBeUndefined();
    expect(after?.currentEndAt).toBeUndefined();
    expect(after?.perpetual).toBe(false);
    await expect(EntitlementAdjustment.countDocuments({ user, type: 'revoke' })).resolves.toBe(1);
  });
});
