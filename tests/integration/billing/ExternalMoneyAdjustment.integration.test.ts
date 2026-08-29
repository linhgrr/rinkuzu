import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import {
  BillingOrder,
  EntitlementAccount,
  EntitlementAdjustment,
  EntitlementGrant,
  ExternalMoneyAdjustment,
  PaymentAttempt,
  PaymentTransaction,
} from '@/models/Billing';
import { createAdjustmentDeps } from '@/lib/billing-factory';
import { recordExternalMoneyAdjustment } from '@/services/billing/adjustments/record-adjustment';
import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

const PROVIDER_ACCOUNT = 'integration-payos-account';

interface SeededOrder {
  publicId: string;
  orderId: Types.ObjectId;
  user: Types.ObjectId;
}

/**
 * Recording an external refund or chargeback is the only way money leaves the
 * system, and it is the one place that must claw Premium back with it. It had
 * no coverage, and its order lookup was reading a public UUID as an ObjectId.
 */
describe('external money adjustment integration', () => {
  // The real wiring, so the configuration switch these tests stub is the one
  // production reads.
  const deps = createAdjustmentDeps();
  const ledger = new EntitlementLedgerRepository();
  const admin = new Types.ObjectId();
  const users: Types.ObjectId[] = [];
  const orders: Types.ObjectId[] = [];

  async function seedPaidFulfilledOrder(finalAmount = 100_000): Promise<SeededOrder> {
    const user = new Types.ObjectId();
    const orderId = new Types.ObjectId();
    const attemptId = new Types.ObjectId();
    const publicId = randomUUID();
    users.push(user);
    orders.push(orderId);

    await BillingOrder.create({
      _id: orderId,
      publicId,
      orderCode: Date.now() * 1_000 + orders.length,
      user,
      planId: 'plan_premium_1m',
      planName: 'Premium 1 tháng',
      currency: 'VND',
      baseAmount: finalAmount,
      discountAmount: 0,
      finalAmount,
      receivedAmount: finalAmount,
      excessAmount: 0,
      durationUnit: 'month',
      durationValue: 1,
      pricingVersion: 1,
      termsVersion: '2026-07-23',
      collectionStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
    });
    await PaymentAttempt.create({
      _id: attemptId,
      order: orderId,
      provider: 'payos',
      providerAccountId: PROVIDER_ACCOUNT,
      environment: 'test',
      currency: 'VND',
      requestedAmount: finalAmount,
      amountPaid: finalAmount,
      amountRemaining: 0,
      collectionStatus: 'paid',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await PaymentTransaction.create({
      provider: 'payos',
      providerAccountId: PROVIDER_ACCOUNT,
      environment: 'test',
      transactionType: 'payment',
      externalReference: `pay-${publicId}`,
      attempt: attemptId,
      order: orderId,
      currency: 'VND',
      signedAmount: finalAmount,
      direction: 'incoming',
      providerEventAt: new Date(),
      rawPayloadHash: randomUUID(),
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() =>
        ledger.appendGrant(
          {
            user,
            sourceType: 'billing_order',
            sourceId: orderId.toString(),
            planId: 'plan_premium_1m',
            planName: 'Premium 1 tháng',
            durationUnit: 'month',
            durationValue: 1,
            committedAt: new Date(),
          },
          session,
        ),
      );
    } finally {
      await session.endSession();
    }

    return { publicId, orderId, user };
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Billing adjustment integration database is unavailable', { cause: error });
    }
  }, 15_000);

  beforeEach(() => {
    vi.stubEnv('PAYOS_PROVIDER_ACCOUNT_ID', PROVIDER_ACCOUNT);
    vi.stubEnv('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED', 'true');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      ExternalMoneyAdjustment.deleteMany({ order: { $in: orders } }),
      PaymentTransaction.deleteMany({ order: { $in: orders } }),
      PaymentAttempt.deleteMany({ order: { $in: orders } }),
      BillingOrder.deleteMany({ _id: { $in: orders } }),
      EntitlementGrant.deleteMany({ user: { $in: users } }),
      EntitlementAdjustment.deleteMany({ user: { $in: users } }),
      EntitlementAccount.deleteMany({ user: { $in: users } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('records a full refund by public order id and revokes that order Premium', async () => {
    const seeded = await seedPaidFulfilledOrder();

    const view = await recordExternalMoneyAdjustment(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund',
      externalReference: `refund-${seeded.publicId}`,
      amount: 100_000,
      currency: 'VND',
      allocation: 'principal',
      occurredAt: new Date().toISOString(),
    });

    // Previously this threw 401 "User identity is invalid" on a valid UUID.
    expect(view.id).toBe(seeded.publicId);
    expect(view.settlementStatus).toBe('refunded');
    // `revoked`, not `review`: the machine was allowed to act and did. Parking
    // every auto-revoked order in the review queue is what made that queue
    // meaningless, and left an operator no way to tell the orders that need a
    // person from the ones already settled.
    expect(view.fulfillmentStatus).toBe('revoked');

    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'revoke' }),
    ).resolves.toBe(1);
    const account = await EntitlementAccount.findOne({ user: seeded.user })
      .lean<{ currentEndAt?: Date; perpetual: boolean }>()
      .exec();
    expect(account?.currentEndAt).toBeUndefined();
    expect(account?.perpetual).toBe(false);
  });

  it('parks the order for a person when it is not allowed to revoke', async () => {
    // The other half of the same rule: `review` is reserved for a genuine gap
    // between the money and the entitlement that no automation may close.
    vi.stubEnv('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED', 'false');
    const seeded = await seedPaidFulfilledOrder();

    const view = await recordExternalMoneyAdjustment(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund',
      externalReference: `refund-manual-${seeded.publicId}`,
      amount: 100_000,
      currency: 'VND',
      allocation: 'principal',
      occurredAt: new Date().toISOString(),
    });

    expect(view.settlementStatus).toBe('refunded');
    expect(view.fulfillmentStatus).toBe('review');
    // The money moved and was recorded; only the entitlement waits for a person.
    await expect(ExternalMoneyAdjustment.countDocuments({ order: seeded.orderId })).resolves.toBe(
      1,
    );
    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'revoke' }),
    ).resolves.toBe(0);
  });

  it('marks a part refund partially_refunded and keeps Premium revoked once', async () => {
    const seeded = await seedPaidFulfilledOrder();

    const view = await recordExternalMoneyAdjustment(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund',
      externalReference: `refund-part-${seeded.publicId}`,
      amount: 40_000,
      currency: 'VND',
      allocation: 'principal',
      occurredAt: new Date().toISOString(),
    });

    expect(view.settlementStatus).toBe('partially_refunded');
    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'revoke' }),
    ).resolves.toBe(1);
  });

  it('is idempotent for a replayed provider reference', async () => {
    const seeded = await seedPaidFulfilledOrder();
    const input = {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'chargeback' as const,
      externalReference: `cb-${seeded.publicId}`,
      amount: 100_000,
      currency: 'VND' as const,
      allocation: 'principal' as const,
      occurredAt: new Date().toISOString(),
    };

    await recordExternalMoneyAdjustment(deps, input);
    const second = await recordExternalMoneyAdjustment(deps, input);

    expect(second.settlementStatus).toBe('charged_back');
    await expect(ExternalMoneyAdjustment.countDocuments({ order: seeded.orderId })).resolves.toBe(
      1,
    );
    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'revoke' }),
    ).resolves.toBe(1);
  });

  it('leaves a separately paid renewal untouched when one order is refunded', async () => {
    const refunded = await seedPaidFulfilledOrder();
    // A second, independently paid order for the same customer.
    const renewalSourceId = new Types.ObjectId().toString();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() =>
        ledger.appendGrant(
          {
            user: refunded.user,
            sourceType: 'billing_order',
            sourceId: renewalSourceId,
            planId: 'plan_premium_1m',
            planName: 'Premium 1 tháng',
            durationUnit: 'month',
            durationValue: 1,
            committedAt: new Date(),
          },
          session,
        ),
      );
    } finally {
      await session.endSession();
    }

    await recordExternalMoneyAdjustment(deps, {
      recordedBy: admin.toString(),
      orderId: refunded.publicId,
      type: 'refund',
      externalReference: `refund-one-of-two-${refunded.publicId}`,
      amount: 100_000,
      currency: 'VND',
      allocation: 'principal',
      occurredAt: new Date().toISOString(),
    });

    // The renewal must survive: revoking the whole account here would delete
    // access the customer paid for in a different order.
    const account = await EntitlementAccount.findOne({ user: refunded.user })
      .lean<{ currentEndAt?: Date }>()
      .exec();
    expect(account?.currentEndAt).toBeInstanceOf(Date);
    expect(account?.currentEndAt?.getTime()).toBeGreaterThan(Date.now());
    await expect(
      EntitlementAdjustment.countDocuments({ user: refunded.user, type: 'revoke' }),
    ).resolves.toBe(1);
  });

  it('gives Premium back when a chargeback is reversed', async () => {
    // The rule the last-event-wins ledger could not express: the money came
    // back, so the access must too. Leaving the customer revoked here is a
    // silent, permanent penalty for the bank changing its mind.
    const seeded = await seedPaidFulfilledOrder();
    const shared = {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      currency: 'VND' as const,
      allocation: 'principal' as const,
      amount: 100_000,
    };

    const chargedBack = await recordExternalMoneyAdjustment(deps, {
      ...shared,
      type: 'chargeback',
      externalReference: `cb-reversed-${seeded.publicId}`,
      occurredAt: new Date().toISOString(),
    });
    expect(chargedBack.settlementStatus).toBe('charged_back');
    expect(chargedBack.fulfillmentStatus).toBe('revoked');

    const reversed = await recordExternalMoneyAdjustment(deps, {
      ...shared,
      type: 'chargeback_reversal',
      externalReference: `cb-reversal-${seeded.publicId}`,
      occurredAt: new Date().toISOString(),
    });

    // `settled`, not a status of its own: the reversal made the customer
    // entitled again, and the whole point of deriving the status from the same
    // ledger is that it cannot report anything else while that is true.
    expect(reversed.settlementStatus).toBe('settled');
    expect(reversed.fulfillmentStatus).toBe('fulfilled');
    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'restore' }),
    ).resolves.toBe(1);
    const account = await EntitlementAccount.findOne({ user: seeded.user })
      .lean<{ currentEndAt?: Date }>()
      .exec();
    expect(account?.currentEndAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not restore twice when a reversal is replayed', async () => {
    const seeded = await seedPaidFulfilledOrder();
    const shared = {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      currency: 'VND' as const,
      allocation: 'principal' as const,
      amount: 100_000,
      occurredAt: new Date().toISOString(),
    };
    await recordExternalMoneyAdjustment(deps, {
      ...shared,
      type: 'chargeback',
      externalReference: `cb-twice-${seeded.publicId}`,
    });
    const reversal = {
      ...shared,
      type: 'chargeback_reversal' as const,
      externalReference: `cb-reversal-twice-${seeded.publicId}`,
    };
    await recordExternalMoneyAdjustment(deps, reversal);
    await recordExternalMoneyAdjustment(deps, reversal);

    await expect(
      EntitlementAdjustment.countDocuments({ user: seeded.user, type: 'restore' }),
    ).resolves.toBe(1);
  });

  it('refuses a reference already recorded against another order', async () => {
    // A mis-keyed entry. Reporting the untouched order back as if it had been
    // adjusted is how money silently lands nowhere.
    const first = await seedPaidFulfilledOrder();
    const second = await seedPaidFulfilledOrder();
    const reference = `shared-ref-${first.publicId}`;
    const shared = {
      recordedBy: admin.toString(),
      type: 'refund' as const,
      externalReference: reference,
      amount: 10_000,
      currency: 'VND' as const,
      allocation: 'principal' as const,
      occurredAt: new Date().toISOString(),
    };

    await recordExternalMoneyAdjustment(deps, { ...shared, orderId: first.publicId });
    await expect(
      recordExternalMoneyAdjustment(deps, { ...shared, orderId: second.publicId }),
    ).rejects.toMatchObject({ code: 'adjustment_reference_conflict', status: 409 });
    await expect(ExternalMoneyAdjustment.countDocuments({ order: second.orderId })).resolves.toBe(
      0,
    );
  });

  it('refuses the same reference carrying different money', async () => {
    const seeded = await seedPaidFulfilledOrder();
    const shared = {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund' as const,
      externalReference: `ref-amount-${seeded.publicId}`,
      currency: 'VND' as const,
      allocation: 'principal' as const,
      occurredAt: new Date().toISOString(),
    };

    await recordExternalMoneyAdjustment(deps, { ...shared, amount: 10_000 });
    await expect(
      recordExternalMoneyAdjustment(deps, { ...shared, amount: 20_000 }),
    ).rejects.toMatchObject({ code: 'adjustment_reference_conflict', status: 409 });
    await expect(ExternalMoneyAdjustment.countDocuments({ order: seeded.orderId })).resolves.toBe(
      1,
    );
  });

  it('rejects an unknown public order id', async () => {
    await expect(
      recordExternalMoneyAdjustment(deps, {
        recordedBy: admin.toString(),
        orderId: randomUUID(),
        type: 'refund',
        externalReference: `refund-missing-${randomUUID()}`,
        amount: 1_000,
        currency: 'VND',
        allocation: 'principal',
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'order_not_found' });
  });
});
