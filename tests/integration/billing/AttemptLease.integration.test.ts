import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { BillingOrder, PaymentAttempt } from '@/models/Billing';
import type { AttemptLease } from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingSettlementRepository } from '@/repositories/billing/BillingSettlementRepository';
import { ATTEMPT_LEASE_MS } from '@/services/billing/domain/schedule';
import { integrationDatabaseUri } from '../../setup/integration-db';

const PRICE = 100_000;

interface StoredLease {
  reconcileLeaseUntil?: Date;
  reconcileLeaseToken?: string;
  collectionStatus: string;
  nextReconcileAt?: Date;
  lastProviderError?: string;
  version: number;
}

/**
 * Two scheduler ticks overlap routinely — a slow tick and the next one on
 * schedule. Without a lease both select the same due rows, each makes its own
 * provider call for them, and they race each other's transitions. The claim is
 * a single `findOneAndUpdate` precisely because only the atomic form can
 * promise that; an in-memory double cannot demonstrate it, so this runs against
 * the local replica set.
 */
describe('attempt lease integration', () => {
  const settlement = new BillingSettlementRepository();
  const orderIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  async function seedDueAttempt(dueAtMs: number): Promise<Types.ObjectId> {
    const orderId = new Types.ObjectId();
    const publicId = randomUUID();
    const orderCode = (codeSeed += 1);
    orderIds.push(orderId);

    await BillingOrder.create({
      _id: orderId,
      publicId,
      orderCode,
      user: new Types.ObjectId(),
      planId: 'plan_premium_1m',
      planName: 'Premium 1 tháng',
      currency: 'VND',
      baseAmount: PRICE,
      discountAmount: 0,
      finalAmount: PRICE,
      receivedAmount: 0,
      excessAmount: 0,
      durationUnit: 'month',
      durationValue: 1,
      pricingVersion: 1,
      termsVersion: '2026-07-23',
      collectionStatus: 'unpaid',
    });
    const attempt = await PaymentAttempt.create({
      order: orderId,
      provider: 'payos',
      providerAccountId: 'lease-integration-account',
      environment: 'test',
      externalOrderId: String(orderCode),
      paymentLinkId: `link-${publicId}`,
      checkoutUrl: `https://pay.payos.vn/web/link-${publicId}`,
      currency: 'VND',
      requestedAmount: PRICE,
      amountPaid: 0,
      amountRemaining: PRICE,
      collectionStatus: 'pending',
      activeForCheckout: true,
      createOutcome: 'created',
      expiresAt: new Date(Date.now() + 3_600_000),
      nextReconcileAt: new Date(dueAtMs),
    });
    return attempt._id as Types.ObjectId;
  }

  async function readLease(attemptId: Types.ObjectId): Promise<StoredLease> {
    const stored = await PaymentAttempt.findById(attemptId).lean<StoredLease>().exec();
    if (!stored) throw new Error('Seeded attempt disappeared');
    return stored;
  }

  /**
   * Drains the way the real one does: one row at a time, inside the budget
   * loop, rather than leasing a batch up front. Only the rows this file seeded
   * are reported, because other suites share the database.
   */
  async function claimOwn(nowMs: number, limit = 20): Promise<string[]> {
    const mine = new Set(orderIds.map((id) => id.toString()));
    const claimed: string[] = [];
    for (let index = 0; index < limit; index += 1) {
      const attempt = await settlement.claimNextDueAttempt({ nowMs, leaseMs: ATTEMPT_LEASE_MS });
      if (attempt === null) break;
      if (mine.has(attempt.orderRef)) claimed.push(attempt.attemptRef);
    }
    return claimed;
  }

  /** Claims one of this file's own rows and hands back its lease. */
  async function leaseOwn(nowMs: number): Promise<AttemptLease> {
    const mine = new Set(orderIds.map((id) => id.toString()));
    for (let index = 0; index < 20; index += 1) {
      const attempt = await settlement.claimNextDueAttempt({ nowMs, leaseMs: ATTEMPT_LEASE_MS });
      if (attempt === null) break;
      if (attempt.lease !== null && mine.has(attempt.orderRef)) return attempt.lease;
    }
    throw new Error('No seeded attempt was claimable');
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Attempt lease integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      PaymentAttempt.deleteMany({ order: { $in: orderIds } }),
      BillingOrder.deleteMany({ _id: { $in: orderIds } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('leases an attempt as it is claimed', async () => {
    const nowMs = Date.now();
    const attemptId = await seedDueAttempt(nowMs - 1_000);

    expect(await claimOwn(nowMs)).toContain(attemptId.toString());
    const stored = await readLease(attemptId);
    expect(stored.reconcileLeaseUntil?.getTime()).toBe(nowMs + ATTEMPT_LEASE_MS);
  });

  it('hides a leased attempt from the next overlapping tick', async () => {
    const nowMs = Date.now();
    const attemptId = await seedDueAttempt(nowMs - 1_000);

    expect(await claimOwn(nowMs)).toContain(attemptId.toString());
    // The second tick starts while the first still holds the row. It must come
    // back empty rather than making a duplicate provider call for it.
    expect(await claimOwn(nowMs + 1_000)).not.toContain(attemptId.toString());
  });

  it('hands the attempt to the next worker once the lease lapses', async () => {
    const nowMs = Date.now();
    const attemptId = await seedDueAttempt(nowMs - 1_000);
    await claimOwn(nowMs);

    // A worker that died holding the lease must not park the row forever.
    const laterMs = nowMs + ATTEMPT_LEASE_MS + 1;
    expect(await claimOwn(laterMs)).toContain(attemptId.toString());
    const stored = await readLease(attemptId);
    expect(stored.reconcileLeaseUntil?.getTime()).toBe(laterMs + ATTEMPT_LEASE_MS);
  });

  it('never hands the same attempt to two concurrent drains', async () => {
    const nowMs = Date.now();
    const attempts = await Promise.all([
      seedDueAttempt(nowMs - 3_000),
      seedDueAttempt(nowMs - 2_000),
      seedDueAttempt(nowMs - 1_000),
    ]);

    // Four drains racing for three rows. The claim is atomic, so the union is
    // every row and the intersection of any two batches is empty.
    const batches = await Promise.all([
      claimOwn(nowMs),
      claimOwn(nowMs),
      claimOwn(nowMs),
      claimOwn(nowMs),
    ]);
    const all = batches.flat();
    expect(new Set(all).size).toBe(all.length);
    for (const attemptId of attempts) {
      expect(all).toContain(attemptId.toString());
    }
  });

  it('leaves an attempt that is not due yet alone', async () => {
    const nowMs = Date.now();
    const attemptId = await seedDueAttempt(nowMs + 60_000);

    expect(await claimOwn(nowMs)).not.toContain(attemptId.toString());
    expect((await readLease(attemptId)).reconcileLeaseUntil).toBeUndefined();
  });

  it('refuses a second lease while the first is still live', async () => {
    const nowMs = Date.now();
    await seedDueAttempt(nowMs - 1_000);
    const lease = await leaseOwn(nowMs);

    // An event-driven settlement — a checkout verification, a webhook — takes
    // the same lease a drain does. While a drain holds it, the event-driven
    // caller reports that rather than writing over the owner.
    const contended = await settlement.acquireAttemptLease({
      attemptRef: lease.attemptRef,
      nowMs: nowMs + 1_000,
      leaseMs: ATTEMPT_LEASE_MS,
    });
    expect(contended).toBeNull();
  });

  it('mints a fresh token when the lease lapses, invalidating the old one', async () => {
    const nowMs = Date.now();
    await seedDueAttempt(nowMs - 1_000);
    const first = await leaseOwn(nowMs);

    const laterMs = nowMs + ATTEMPT_LEASE_MS + 1;
    const reclaimed = await settlement.acquireAttemptLease({
      attemptRef: first.attemptRef,
      nowMs: laterMs,
      leaseMs: ATTEMPT_LEASE_MS,
    });
    expect(reclaimed?.lease).not.toBeNull();
    expect(reclaimed?.lease?.token).not.toBe(first.token);
  });

  describe('a worker whose lease was reclaimed', () => {
    /**
     * The race this fences. Worker A claims an attempt and goes to the
     * provider. Its lease lapses, worker B reclaims the row and settles it.
     * Worker A comes back holding a verdict about a world that no longer
     * exists; every write it can still make must match nothing.
     */
    async function reclaimed(): Promise<{ stale: AttemptLease; live: AttemptLease }> {
      const nowMs = Date.now();
      await seedDueAttempt(nowMs - 1_000);
      const stale = await leaseOwn(nowMs);
      const laterMs = nowMs + ATTEMPT_LEASE_MS + 1;
      const snapshot = await settlement.acquireAttemptLease({
        attemptRef: stale.attemptRef,
        nowMs: laterMs,
        leaseMs: ATTEMPT_LEASE_MS,
      });
      if (!snapshot?.lease) throw new Error('Reclaim did not produce a lease');
      return { stale, live: snapshot.lease };
    }

    /** The order a seeded attempt belongs to. */
    async function orderRefOf(attemptRef: string): Promise<string> {
      const attempt = await PaymentAttempt.findById(attemptRef)
        .lean<{ order: Types.ObjectId }>()
        .exec();
      if (!attempt) throw new Error('Seeded attempt disappeared');
      return attempt.order.toString();
    }

    it('cannot escalate the attempt out from under the new owner', async () => {
      const { stale } = await reclaimed();
      const before = await readLease(new Types.ObjectId(stale.attemptRef));
      const orderRef = await orderRefOf(stale.attemptRef);

      const outcome = await settlement.inSettlementTransaction((tx) =>
        tx.escalateAttempt({
          lease: stale,
          orderRef,
          reason: 'reconciliation_stalled',
          freezesOrder: true,
        }),
      );

      expect(outcome).toBe('lease_lost');
      const after = await readLease(new Types.ObjectId(stale.attemptRef));
      expect(after.collectionStatus).toBe(before.collectionStatus);
      expect(after.version).toBe(before.version);
    });

    it('cannot freeze the order either, because the escalation matched nothing', async () => {
      const { stale } = await reclaimed();
      const attempt = await PaymentAttempt.findById(stale.attemptRef)
        .lean<{ order: Types.ObjectId }>()
        .exec();
      if (!attempt) throw new Error('Seeded attempt disappeared');

      await settlement.inSettlementTransaction((tx) =>
        tx.escalateAttempt({
          lease: stale,
          orderRef: attempt.order.toString(),
          reason: 'reconciliation_stalled',
          freezesOrder: true,
        }),
      );

      // By the time worker A woke up the order may already have been settled
      // and fulfilled by worker B. Freezing it here would revoke nothing and
      // strand a paid customer in the operator queue.
      const order = await BillingOrder.findById(attempt.order)
        .lean<{ collectionStatus: string }>()
        .exec();
      expect(order?.collectionStatus).toBe('unpaid');
    });

    it('cannot push the attempt back into the queue', async () => {
      const { stale } = await reclaimed();
      const before = await readLease(new Types.ObjectId(stale.attemptRef));

      const outcome = await settlement.inSettlementTransaction((tx) =>
        tx.rescheduleAttempt({
          lease: stale,
          nextReconcileAtMs: Date.now() + 3_600_000,
          lastProviderError: 'stale worker verdict',
        }),
      );

      expect(outcome).toBe('lease_lost');
      const after = await readLease(new Types.ObjectId(stale.attemptRef));
      expect(after.nextReconcileAt?.getTime()).toBe(before.nextReconcileAt?.getTime());
      expect(after.lastProviderError).toBeUndefined();
    });

    it('reports a lost lease rather than a lost optimistic race', async () => {
      const { stale } = await reclaimed();
      const stored = await readLease(new Types.ObjectId(stale.attemptRef));

      const outcome = await settlement.inSettlementTransaction((tx) =>
        tx.applyAttemptTransition({
          lease: stale,
          expectedVersion: stored.version,
          expectedStatus: 'pending',
          status: 'expired',
          paymentLinkId: 'link-stale',
          amountPaidMinor: 0,
          amountRemainingMinor: PRICE,
          activeForCheckout: false,
          settledAtMs: Date.now(),
          nextReconcileAtMs: null,
        }),
      );

      // The two answers mean different things: `stale` is a race the caller
      // may drop because the winner left its own follow-up, `lease_lost` means
      // this worker must write nothing more at all.
      expect(outcome).toBe('lease_lost');
      expect((await readLease(new Types.ObjectId(stale.attemptRef))).collectionStatus).toBe(
        'pending',
      );
    });

    it('still lets the live owner write', async () => {
      const { live } = await reclaimed();

      const outcome = await settlement.inSettlementTransaction((tx) =>
        tx.rescheduleAttempt({
          lease: live,
          nextReconcileAtMs: Date.now() + 3_600_000,
          lastProviderError: 'provider unavailable',
        }),
      );

      expect(outcome).toBe('applied');
      const after = await readLease(new Types.ObjectId(live.attemptRef));
      expect(after.lastProviderError).toBe('provider unavailable');
      // The write released the claim, so the next tick can pick the row up.
      expect(after.reconcileLeaseToken).toBeUndefined();
    });
  });
});
