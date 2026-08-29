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
import { BillingSettlementRepository } from '@/repositories/billing/BillingSettlementRepository';
import { recordExternalMoneyAdjustment } from '@/services/billing/adjustments/record-adjustment';
import { FULFILLMENT_LEASE_MS } from '@/services/billing/domain/schedule';
import type { BillingPaymentProvider } from '@/services/billing/payos-adapter';
import { fulfillOrder } from '@/services/billing/settlement/fulfill-order';
import { drainFulfillmentBacklog } from '@/services/billing/settlement/drains';
import type { SettlementDeps } from '@/services/billing/settlement/settle-attempt';
import { integrationDatabaseUri } from '../../setup/integration-db';

const PROVIDER_ACCOUNT = 'entitlement-race-account';
const PRICE = 100_000;

interface SeededOrder {
  orderId: Types.ObjectId;
  publicId: string;
  userId: Types.ObjectId;
}

interface StoredOrder {
  receivedAmount: number;
  netPrincipalAmount?: number;
  finalAmount: number;
  settlementStatus: string;
  collectionStatus: string;
  fulfillmentStatus: string;
  fulfillmentNextAttemptAt?: Date;
  fulfillmentLeaseToken?: string;
}

/**
 * Money that came back must never turn into Premium afterwards.
 *
 * The bug this file fences was a two-commit gap. Fulfillment keyed off the
 * *collection* status, so an order the provider had collected in full stayed
 * `paid` after it was refunded, stayed queued, and the next worker granted
 * Premium for it. Recording the refund cancelled nothing, and nothing in the
 * grant commit re-checked the money.
 *
 * The fix is one predicate — `netPrincipal >= finalAmount` — carried in three
 * places: the claim that arms the work item, the claim that leases it, and the
 * filter on the single update that makes the grant real. The third is the only
 * one that can decide a genuine race, and it can only be demonstrated against
 * real documents in a real transaction, which is why this suite is here rather
 * than against the in-memory double.
 */
describe('entitlement never outlives the money', () => {
  const settlement = new BillingSettlementRepository();
  const adjustments = createAdjustmentDeps();
  const admin = new Types.ObjectId();
  const orderIds: Types.ObjectId[] = [];
  const userIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  const unusedProvider: BillingPaymentProvider = {
    getPayment: async () => {
      throw new Error('the provider is not exercised by these tests');
    },
    createCheckout: async () => {
      throw new Error('the provider is not exercised by these tests');
    },
    cancelPayment: async () => {
      throw new Error('the provider is not exercised by these tests');
    },
  };

  const deps: SettlementDeps = {
    settlement,
    provider: unusedProvider,
    clock: () => Date.now(),
    random: () => 0.5,
    autoActivationEnabled: () => true,
  };

  /**
   * An order whose money is already recorded and which is queued for its first
   * fulfillment — exactly the state the settlement commit leaves behind.
   */
  async function seedQueuedOrder(receivedAmount = PRICE): Promise<SeededOrder> {
    const orderId = new Types.ObjectId();
    const attemptId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const publicId = randomUUID();
    const orderCode = (codeSeed += 1);
    orderIds.push(orderId);
    userIds.push(userId);

    await BillingOrder.create({
      _id: orderId,
      publicId,
      orderCode,
      user: userId,
      planId: 'plan_premium_1m',
      planName: 'Premium 1 tháng',
      currency: 'VND',
      baseAmount: PRICE,
      discountAmount: 0,
      finalAmount: PRICE,
      receivedAmount,
      netPrincipalAmount: receivedAmount,
      excessAmount: 0,
      durationUnit: 'month',
      durationValue: 1,
      pricingVersion: 1,
      termsVersion: '2026-07-23',
      collectionStatus: receivedAmount >= PRICE ? 'paid' : 'partial',
      settlementStatus: receivedAmount >= PRICE ? 'settled' : 'unsettled',
      fulfillmentStatus: 'unfulfilled',
      fullyCollectedAt: receivedAmount >= PRICE ? new Date() : undefined,
      fulfillmentNextAttemptAt: new Date(Date.now() - 1_000),
      providerPaidAt: new Date(),
    });
    await PaymentAttempt.create({
      _id: attemptId,
      order: orderId,
      provider: 'payos',
      providerAccountId: PROVIDER_ACCOUNT,
      environment: 'test',
      externalOrderId: String(orderCode),
      paymentLinkId: `link-${publicId}`,
      checkoutUrl: `https://pay.payos.vn/web/link-${publicId}`,
      currency: 'VND',
      requestedAmount: PRICE,
      amountPaid: receivedAmount,
      amountRemaining: Math.max(0, PRICE - receivedAmount),
      collectionStatus: receivedAmount >= PRICE ? 'paid' : 'partial',
      activeForCheckout: false,
      createOutcome: 'created',
      expiresAt: new Date(Date.now() + 3_600_000),
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
      signedAmount: receivedAmount,
      direction: 'incoming',
      providerEventAt: new Date(),
      rawPayloadHash: randomUUID(),
    });

    return { orderId, publicId, userId };
  }

  async function readOrder(orderId: Types.ObjectId): Promise<StoredOrder> {
    const stored = await BillingOrder.findById(orderId).lean<StoredOrder>().exec();
    if (!stored) throw new Error('Seeded order disappeared');
    return stored;
  }

  async function grantCount(userId: Types.ObjectId): Promise<number> {
    return EntitlementGrant.countDocuments({ user: userId });
  }

  function refund(
    seeded: SeededOrder,
    amount: number,
    suffix = 'full',
    occurredAt = new Date().toISOString(),
  ): Promise<unknown> {
    return recordExternalMoneyAdjustment(adjustments, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund',
      externalReference: `refund-${suffix}-${seeded.publicId}`,
      amount,
      currency: 'VND',
      allocation: 'principal',
      occurredAt,
    });
  }

  /** Puts a cancelled work item back, as a stale queue entry or a retry would. */
  async function rearm(seeded: SeededOrder): Promise<void> {
    await BillingOrder.updateOne(
      { _id: seeded.orderId },
      { $set: { fulfillmentNextAttemptAt: new Date(Date.now() - 1_000) } },
    );
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Entitlement race integration database is unavailable', { cause: error });
    }
  }, 15_000);

  beforeEach(() => {
    vi.stubEnv('PAYOS_PROVIDER_ACCOUNT_ID', PROVIDER_ACCOUNT);
    vi.stubEnv('ENTITLEMENT_AUTO_ACTIVATION_ENABLED', 'true');
    vi.stubEnv('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED', 'true');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      ExternalMoneyAdjustment.deleteMany({ order: { $in: orderIds } }),
      PaymentTransaction.deleteMany({ order: { $in: orderIds } }),
      PaymentAttempt.deleteMany({ order: { $in: orderIds } }),
      BillingOrder.deleteMany({ _id: { $in: orderIds } }),
      EntitlementGrant.deleteMany({ user: { $in: userIds } }),
      EntitlementAdjustment.deleteMany({ user: { $in: userIds } }),
      EntitlementAccount.deleteMany({ user: { $in: userIds } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  describe('a refund that lands before the fulfillment worker', () => {
    it('takes the order out of the queue in the same commit that records it', async () => {
      const seeded = await seedQueuedOrder();

      await refund(seeded, PRICE);

      const stored = await readOrder(seeded.orderId);
      // Not merely "the worker would refuse it" — the work item is gone, so no
      // worker ever claims it and no lease is spent on it.
      expect(stored.fulfillmentNextAttemptAt).toBeUndefined();
      expect(stored.netPrincipalAmount).toBe(0);
      expect(stored.settlementStatus).toBe('refunded');
      // The collection status still says what the provider collected. That is
      // the distinction the old code collapsed.
      expect(stored.collectionStatus).toBe('paid');
    });

    it('grants nothing when the order is fulfilled anyway', async () => {
      const seeded = await seedQueuedOrder();
      await refund(seeded, PRICE);

      // Force the work item back, as a stale queue entry or an operator retry
      // would. The grant must still be refused on the money alone.
      await rearm(seeded);

      const result = await fulfillOrder(deps, seeded.orderId.toString());

      expect(result).toEqual({ outcome: 'skipped', reason: 'not_entitled' });
      await expect(grantCount(seeded.userId)).resolves.toBe(0);
      expect((await readOrder(seeded.orderId)).fulfillmentStatus).toBe('unfulfilled');
    });

    it('grants nothing from the backlog drain either', async () => {
      const seeded = await seedQueuedOrder();
      await refund(seeded, PRICE);
      await rearm(seeded);

      await drainFulfillmentBacklog(deps, { limit: 50, budgetMs: 20_000 });

      await expect(grantCount(seeded.userId)).resolves.toBe(0);
    });

    it('withholds the grant from a part-refunded order too', async () => {
      // One dong short is still short. The predicate is an inequality on the
      // whole ledger, not a test for "was anything refunded".
      const seeded = await seedQueuedOrder();
      await refund(seeded, 1, 'one-dong');
      await rearm(seeded);

      const result = await fulfillOrder(deps, seeded.orderId.toString());

      expect(result).toEqual({ outcome: 'skipped', reason: 'not_entitled' });
      await expect(grantCount(seeded.userId)).resolves.toBe(0);
    });
  });

  describe('a refund that lands while the worker is granting', () => {
    it('rolls the grant back rather than letting whichever commit was quicker win', async () => {
      const seeded = await seedQueuedOrder();
      // Worker A leases the order and is about to write the grant.
      const claim = await settlement.inFulfillmentTransaction(seeded.orderId.toString(), (tx) =>
        tx.claim({
          orderRef: seeded.orderId.toString(),
          nowMs: Date.now(),
          leaseMs: FULFILLMENT_LEASE_MS,
        }),
      );
      if (!claim) throw new Error('The seeded order was not claimable');
      expect(claim.entitled).toBe(true);

      // The refund commits in the gap between the claim and the grant.
      await refund(seeded, PRICE);

      // Worker A now runs the grant commit it decided on before the refund.
      await expect(
        settlement.inFulfillmentTransaction(seeded.orderId.toString(), async (tx) => {
          await tx.grantEntitlement({
            orderRef: seeded.orderId.toString(),
            userRef: seeded.userId.toString(),
            planId: 'plan_premium_1m',
            planName: 'Premium 1 tháng',
            durationUnit: 'month',
            durationValue: 1,
            committedAtMs: Date.now(),
            providerPaidAtMs: Date.now(),
          });
          await tx.markFulfilled({ lease: claim.lease, fulfilledAtMs: Date.now() });
        }),
        // Cancelling the queued work is the adjustment's *first* act and it
        // drops the lease, so this worker is already dispossessed by the time
        // it reaches the grant. Either verdict rolls the commit back; which one
        // it is tells the caller whether to retry, and here it must not.
      ).rejects.toMatchObject({ code: 'fulfillment_lease_lost', status: 409 });

      // The throw rolled the whole commit back, grant included. An entitlement
      // that outlived the money that paid for it is the failure being fenced.
      await expect(grantCount(seeded.userId)).resolves.toBe(0);
      const stored = await readOrder(seeded.orderId);
      expect(stored.fulfillmentStatus).toBe('unfulfilled');
    });

    it('refuses the grant on the money alone when the lease is still held', async () => {
      // The other half of the same fence, with the lease deliberately left
      // intact: a reconciliation re-projecting the order lowers the net
      // principal without touching the fulfillment queue, so the only thing
      // standing between the worker and a wrongly granted entitlement is the
      // entitlement predicate on the update that makes the grant real.
      const seeded = await seedQueuedOrder();
      const claim = await settlement.inFulfillmentTransaction(seeded.orderId.toString(), (tx) =>
        tx.claim({
          orderRef: seeded.orderId.toString(),
          nowMs: Date.now(),
          leaseMs: FULFILLMENT_LEASE_MS,
        }),
      );
      if (!claim) throw new Error('The seeded order was not claimable');

      await settlement.inSettlementTransaction((tx) =>
        tx.applyOrderCollection({
          orderRef: seeded.orderId.toString(),
          receivedMinor: PRICE,
          excessMinor: 0,
          netPrincipalMinor: 0,
          settlementStatus: 'refunded',
          excessResolution: 'none',
          collectionStatus: 'paid',
          providerPaidAtMs: Date.now(),
          fullyCollectedAtMs: Date.now(),
        }),
      );

      await expect(
        settlement.inFulfillmentTransaction(seeded.orderId.toString(), async (tx) => {
          await tx.grantEntitlement({
            orderRef: seeded.orderId.toString(),
            userRef: seeded.userId.toString(),
            planId: 'plan_premium_1m',
            planName: 'Premium 1 tháng',
            durationUnit: 'month',
            durationValue: 1,
            committedAtMs: Date.now(),
            providerPaidAtMs: Date.now(),
          });
          await tx.markFulfilled({ lease: claim.lease, fulfilledAtMs: Date.now() });
        }),
      ).rejects.toMatchObject({ code: 'fulfillment_not_entitled', status: 409 });

      await expect(grantCount(seeded.userId)).resolves.toBe(0);
      expect((await readOrder(seeded.orderId)).fulfillmentStatus).toBe('unfulfilled');
    });

    it('invalidates the worker lease, so the stale worker cannot record a verdict', async () => {
      const seeded = await seedQueuedOrder();
      const claim = await settlement.inFulfillmentTransaction(seeded.orderId.toString(), (tx) =>
        tx.claim({
          orderRef: seeded.orderId.toString(),
          nowMs: Date.now(),
          leaseMs: FULFILLMENT_LEASE_MS,
        }),
      );
      if (!claim) throw new Error('The seeded order was not claimable');

      await refund(seeded, PRICE);

      // Cancelling the queued work drops the lease as well as the due time, so
      // the worker that was mid-flight owns nothing and writes nothing.
      const rescheduled = await settlement.inFulfillmentTransaction(
        seeded.orderId.toString(),
        (tx) => tx.reschedule({ lease: claim.lease, dueAtMs: Date.now(), lastError: null }),
      );
      expect(rescheduled).toBe('lease_lost');
      expect((await readOrder(seeded.orderId)).fulfillmentNextAttemptAt).toBeUndefined();
    });
  });

  describe('a credit that makes an underpaid order whole', () => {
    it('arms fulfillment rather than trying to restore a grant that never existed', async () => {
      const seeded = await seedQueuedOrder(60_000);
      // Not entitled yet, so nothing to grant.
      await BillingOrder.updateOne(
        { _id: seeded.orderId },
        { $unset: { fulfillmentNextAttemptAt: 1 } },
      );

      await recordExternalMoneyAdjustment(adjustments, {
        recordedBy: admin.toString(),
        orderId: seeded.publicId,
        type: 'credit',
        externalReference: `credit-${seeded.publicId}`,
        amount: 40_000,
        currency: 'VND',
        allocation: 'principal',
        occurredAt: new Date().toISOString(),
      });

      const armed = await readOrder(seeded.orderId);
      expect(armed.netPrincipalAmount).toBe(PRICE);
      expect(armed.settlementStatus).toBe('settled');
      expect(armed.fulfillmentNextAttemptAt).toBeInstanceOf(Date);

      const result = await fulfillOrder(deps, seeded.orderId.toString());
      expect(result.outcome).toBe('granted');
      await expect(grantCount(seeded.userId)).resolves.toBe(1);
    });

    it('claws the grant back when the credit is itself refunded', async () => {
      const seeded = await seedQueuedOrder(60_000);
      await BillingOrder.updateOne(
        { _id: seeded.orderId },
        { $unset: { fulfillmentNextAttemptAt: 1 } },
      );
      await recordExternalMoneyAdjustment(adjustments, {
        recordedBy: admin.toString(),
        orderId: seeded.publicId,
        type: 'credit',
        externalReference: `credit-back-${seeded.publicId}`,
        amount: 40_000,
        currency: 'VND',
        allocation: 'principal',
        occurredAt: new Date().toISOString(),
      });
      await fulfillOrder(deps, seeded.orderId.toString());
      await expect(grantCount(seeded.userId)).resolves.toBe(1);

      await refund(seeded, 40_000, 'undo-credit');

      const stored = await readOrder(seeded.orderId);
      expect(stored.netPrincipalAmount).toBe(60_000);
      expect(stored.fulfillmentStatus).toBe('revoked');
      await expect(
        EntitlementAdjustment.countDocuments({ user: seeded.userId, type: 'revoke' }),
      ).resolves.toBe(1);
      const account = await EntitlementAccount.findOne({ user: seeded.userId })
        .lean<{ currentEndAt?: Date }>()
        .exec();
      expect(account?.currentEndAt).toBeUndefined();
    });
  });

  describe('the settled projection', () => {
    it('is idempotent: recording the same money twice leaves the same order', async () => {
      const seeded = await seedQueuedOrder();
      await fulfillOrder(deps, seeded.orderId.toString());
      const first = await readOrder(seeded.orderId);

      // A replayed adjustment reference is a no-op on the ledger, so every
      // projection derived from it has to come back unchanged.
      const occurredAt = new Date().toISOString();
      await refund(seeded, 10_000, 'replayed', occurredAt);
      const afterOne = await readOrder(seeded.orderId);
      await refund(seeded, 10_000, 'replayed', occurredAt);
      const afterTwo = await readOrder(seeded.orderId);

      expect(first.settlementStatus).toBe('settled');
      expect(afterTwo.netPrincipalAmount).toBe(afterOne.netPrincipalAmount);
      expect(afterTwo.settlementStatus).toBe(afterOne.settlementStatus);
      expect(afterTwo.fulfillmentStatus).toBe(afterOne.fulfillmentStatus);
      await expect(ExternalMoneyAdjustment.countDocuments({ order: seeded.orderId })).resolves.toBe(
        1,
      );
    });

    it('never reports settled on an order the customer is not entitled to', async () => {
      // The invariant stated directly: status and entitlement are two readings
      // of one number, so they cannot disagree whatever the sequence was.
      const seeded = await seedQueuedOrder();
      const sequence: Array<[string, number, 'refund' | 'chargeback' | 'credit']> = [
        ['a', 30_000, 'refund'],
        ['b', 30_000, 'chargeback'],
        ['c', 20_000, 'credit'],
      ];
      for (const [suffix, amount, type] of sequence) {
        await recordExternalMoneyAdjustment(adjustments, {
          recordedBy: admin.toString(),
          orderId: seeded.publicId,
          type,
          externalReference: `mixed-${suffix}-${seeded.publicId}`,
          amount,
          currency: 'VND',
          allocation: 'principal',
          occurredAt: new Date().toISOString(),
        });
        const stored = await readOrder(seeded.orderId);
        const entitled = (stored.netPrincipalAmount ?? stored.receivedAmount) >= stored.finalAmount;
        expect(stored.settlementStatus === 'settled').toBe(entitled);
      }
    });
  });
});
