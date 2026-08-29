import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { BillingOrder, PaymentAttempt, PaymentTransaction } from '@/models/Billing';
import { createAdjustmentDeps } from '@/lib/billing-factory';
import {
  recordExternalMoneyAdjustment,
  resolveOrderExcess,
} from '@/services/billing/adjustments/record-adjustment';
import { BillingOrderRepository } from '@/repositories/billing/BillingOrderRepository';
import { BillingPromotionRepository } from '@/repositories/billing/BillingPromotionRepository';
import { BillingSettlementRepository } from '@/repositories/billing/BillingSettlementRepository';
import { BillingService } from '@/services/billing/BillingService';
import { BillingDomainError } from '@/services/billing/billing-domain';
import type {
  BillingPaymentProvider,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';
import { integrationDatabaseUri } from '../../setup/integration-db';

const PROVIDER_ACCOUNT = 'overpayment-integration-account';
const PRICE = 100_000;
const OVERPAID = 130_000;

interface SeededOrder {
  orderId: Types.ObjectId;
  publicId: string;
  orderCode: number;
  paymentLinkId: string;
}

interface StoredExcess {
  excessAmount: number;
  excessResolution: string;
  excessResolutionReason?: string;
  excessResolvedBy?: Types.ObjectId;
  excessResolvedAt?: Date;
  collectionStatus: string;
}

/**
 * An overpayment is the one billing state automation can detect but must never
 * close, and there is exactly one place that closes it: the adjustment ledger.
 *
 * An operator's verdict is an excess-allocated `ExternalMoneyAdjustment` like
 * any other money event, and the field on the order is derived from the whole
 * ledger by every path that touches the order. That is why reconciliation can
 * now write it unconditionally — re-deriving from a ledger that already records
 * the disposal produces the disposal again. The previous shape was a bare enum
 * set by a command that moved no money, kept alive only by blinding the
 * derivation to the states an operator could reach.
 */
describe('overpayment lifecycle integration', () => {
  // The real wiring, so the configuration switch these tests stub is the one
  // production reads.
  const deps = createAdjustmentDeps();
  const admin = new Types.ObjectId();
  const orderIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  function serviceReturning(snapshot: ProviderPaymentSnapshot): BillingService {
    const provider: BillingPaymentProvider = {
      getPayment: async () => snapshot,
      createCheckout: async () => {
        throw new Error('createCheckout is not exercised by these tests');
      },
      cancelPayment: async () => snapshot,
    };
    return new BillingService(
      new BillingOrderRepository(provider),
      new BillingSettlementRepository(),
      new BillingPromotionRepository(),
      provider,
    );
  }

  function paidSnapshot(seeded: SeededOrder, amountPaid: number): ProviderPaymentSnapshot {
    return {
      id: seeded.paymentLinkId,
      orderCode: seeded.orderCode,
      amount: PRICE,
      amountPaid,
      amountRemaining: Math.max(0, PRICE - amountPaid),
      currency: 'VND',
      status: 'PAID',
      createdAt: new Date().toISOString(),
      transactions: [
        {
          reference: `txn-${seeded.orderCode}`,
          amount: amountPaid,
          transactionDateTime: new Date().toISOString(),
          counterAccountNumber: '0123456789',
        },
      ],
    };
  }

  async function seedPayableOrder(): Promise<SeededOrder> {
    const orderId = new Types.ObjectId();
    const publicId = randomUUID();
    const orderCode = (codeSeed += 1);
    const paymentLinkId = `link-${publicId}`;
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
    await PaymentAttempt.create({
      order: orderId,
      provider: 'payos',
      providerAccountId: PROVIDER_ACCOUNT,
      environment: 'test',
      externalOrderId: String(orderCode),
      paymentLinkId,
      checkoutUrl: `https://pay.payos.vn/web/${paymentLinkId}`,
      currency: 'VND',
      requestedAmount: PRICE,
      amountPaid: 0,
      amountRemaining: PRICE,
      collectionStatus: 'pending',
      activeForCheckout: true,
      createOutcome: 'created',
      expiresAt: new Date(Date.now() + 3_600_000),
      nextReconcileAt: new Date(Date.now() - 1_000),
    });

    return { orderId, publicId, orderCode, paymentLinkId };
  }

  async function readExcess(orderId: Types.ObjectId): Promise<StoredExcess> {
    const stored = await BillingOrder.findById(orderId).lean<StoredExcess>().exec();
    if (!stored) throw new Error('Seeded order disappeared');
    return stored;
  }

  /** Drives the real settlement path, which is what writes the derived value. */
  async function reconcile(seeded: SeededOrder, amountPaid = OVERPAID): Promise<void> {
    await serviceReturning(paidSnapshot(seeded, amountPaid)).reconcileDueAttempts({ limit: 50 });
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Overpayment integration database is unavailable', { cause: error });
    }
  }, 15_000);

  beforeEach(() => {
    vi.stubEnv('PAYOS_PROVIDER_ACCOUNT_ID', PROVIDER_ACCOUNT);
    // These tests are about money visibility, not about granting access.
    vi.stubEnv('ENTITLEMENT_AUTO_ACTIVATION_ENABLED', 'false');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      PaymentTransaction.deleteMany({ order: { $in: orderIds } }),
      PaymentAttempt.deleteMany({ order: { $in: orderIds } }),
      BillingOrder.deleteMany({ _id: { $in: orderIds } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('queues an overpayment for a person instead of disposing of it', async () => {
    const seeded = await seedPayableOrder();
    await reconcile(seeded);

    const stored = await readExcess(seeded.orderId);
    expect(stored.collectionStatus).toBe('overpaid');
    expect(stored.excessAmount).toBe(OVERPAID - PRICE);
    expect(stored.excessResolution).toBe('unallocated');
    expect(stored.excessResolvedBy).toBeUndefined();
  });

  it('records who closed an overpayment, when, and why', async () => {
    const seeded = await seedPayableOrder();
    await reconcile(seeded);

    const view = await resolveOrderExcess(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      command: 'refund',
      reason: 'Returned to the payer bank account on 2026-08-28',
    });
    expect(view.id).toBe(seeded.publicId);

    const stored = await readExcess(seeded.orderId);
    expect(stored.excessResolution).toBe('refunded');
    expect(stored.excessResolutionReason).toBe('Returned to the payer bank account on 2026-08-28');
    expect(stored.excessResolvedBy?.toString()).toBe(admin.toString());
    expect(stored.excessResolvedAt).toBeInstanceOf(Date);
  });

  it('does not reopen a closed overpayment on the next reconciliation', async () => {
    // The regression. The payment ledger reports the same excess forever, so a
    // derivation written back unconditionally undoes the operator every tick.
    const seeded = await seedPayableOrder();
    await reconcile(seeded);
    await resolveOrderExcess(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      command: 'credit',
      reason: 'Converted to account credit at the payer request',
    });

    await PaymentAttempt.updateMany(
      { order: seeded.orderId },
      {
        $set: { nextReconcileAt: new Date(Date.now() - 1_000) },
        $unset: { reconcileLeaseUntil: 1 },
      },
    );
    await reconcile(seeded);

    const stored = await readExcess(seeded.orderId);
    expect(stored.excessResolution).toBe('credited');
    // The amounts are still refreshed; only the verdict is off limits.
    expect(stored.excessAmount).toBe(OVERPAID - PRICE);
    expect(stored.collectionStatus).toBe('overpaid');
  });

  it('reads a disposal recorded through the adjustment surface as the same verdict', async () => {
    // One source of truth, exercised from the other door. An excess-allocated
    // adjustment recorded as external money closes the overpayment exactly as
    // an operator verdict does, because the field on the order is derived from
    // the ledger both of them write to.
    const seeded = await seedPayableOrder();
    await reconcile(seeded);

    await recordExternalMoneyAdjustment(deps, {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      type: 'refund',
      externalReference: `bank-excess-${seeded.publicId}`,
      amount: OVERPAID - PRICE,
      currency: 'VND',
      allocation: 'excess',
      occurredAt: new Date().toISOString(),
    });

    const stored = await readExcess(seeded.orderId);
    expect(stored.excessResolution).toBe('refunded');
    // And the operator command now has nothing left to decide, rather than
    // being free to dispose of the same surplus a second time.
    await expect(
      resolveOrderExcess(deps, {
        recordedBy: admin.toString(),
        orderId: seeded.publicId,
        command: 'write_off',
        reason: 'Trying to close a surplus that already went back',
      }),
    ).rejects.toMatchObject({ code: 'excess_not_resolvable', status: 409 });
  });

  it('refuses a second verdict on the same overpayment', async () => {
    const seeded = await seedPayableOrder();
    await reconcile(seeded);
    const input = {
      recordedBy: admin.toString(),
      orderId: seeded.publicId,
      command: 'write_off' as const,
      reason: 'Below the cost of returning it',
    };
    await resolveOrderExcess(deps, input);

    // Reported as a conflict rather than quietly succeeding: the second
    // operator has to learn the money already went somewhere.
    await expect(resolveOrderExcess(deps, input)).rejects.toMatchObject({
      code: 'excess_not_resolvable',
      status: 409,
    });
  });

  it('refuses a verdict on an order that never overpaid', async () => {
    const seeded = await seedPayableOrder();
    await reconcile(seeded, PRICE);
    expect((await readExcess(seeded.orderId)).excessResolution).toBe('none');

    await expect(
      resolveOrderExcess(deps, {
        recordedBy: admin.toString(),
        orderId: seeded.publicId,
        command: 'refund',
        reason: 'There is nothing here to refund',
      }),
    ).rejects.toBeInstanceOf(BillingDomainError);
  });

  it('refuses a verdict with no stated reason', async () => {
    // This is the one billing transition with no machine-checkable
    // justification, so the audit trail is the only record of why.
    const seeded = await seedPayableOrder();
    await reconcile(seeded);

    await expect(
      resolveOrderExcess(deps, {
        recordedBy: admin.toString(),
        orderId: seeded.publicId,
        command: 'refund',
        reason: '   ',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect((await readExcess(seeded.orderId)).excessResolution).toBe('unallocated');
  });

  it('reports an unknown order rather than creating one', async () => {
    await expect(
      resolveOrderExcess(deps, {
        recordedBy: admin.toString(),
        orderId: randomUUID(),
        command: 'refund',
        reason: 'No such order',
      }),
    ).rejects.toMatchObject({ code: 'order_not_found', status: 404 });
  });
});
