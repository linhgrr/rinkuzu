import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { BillingOrder, PaymentAttempt, PaymentTransaction } from '@/models/Billing';
import { BillingRepository } from '@/repositories/BillingRepository';
import type {
  BillingPaymentProvider,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';

const uri = process.env['MONGODB_URI'];
const databaseName = uri ? decodeURIComponent(new URL(uri).pathname.slice(1)) : '';
const isSafeTestDb = /(^|[-_])(test|ci)($|[-_])/i.exec(databaseName) !== null;

if (!uri) {
  throw new Error('MONGODB_URI is required for attempt reconciliation integration tests');
}
if (!isSafeTestDb) {
  throw new Error(
    `Refusing integration tests against non-test database: ${databaseName || '<empty>'}`,
  );
}

const PROVIDER_ACCOUNT = 'reconcile-integration-account';
const PRICE = 100_000;

interface SeededAttempt {
  orderId: Types.ObjectId;
  attemptId: Types.ObjectId;
  publicId: string;
  orderCode: number;
  userId: string;
  paymentLinkId: string;
}

interface SeedAttemptOptions {
  attemptStatus: string;
  activeForCheckout: boolean;
  expiresAt: Date;
  terminalConfirmedAt?: Date;
}

/**
 * These two rules only show up against real documents: one drops money on the
 * floor when the rank ladder refuses a transition, the other leaves a dead
 * checkout link advertised as payable. Both run through `reconcileAttempt`,
 * which the webhook drain and the user's own Verify button share.
 */
describe('payment attempt reconciliation integration', () => {
  const orderIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  function repositoryReturning(snapshot: ProviderPaymentSnapshot): BillingRepository {
    const provider: BillingPaymentProvider = {
      getPayment: async () => snapshot,
      createCheckout: async () => {
        throw new Error('createCheckout is not exercised by these tests');
      },
      cancelPayment: async () => snapshot,
    };
    return new BillingRepository(provider);
  }

  function repositoryThatFailsFor(failingOrderCode: number, ok: ProviderPaymentSnapshot) {
    const provider: BillingPaymentProvider = {
      getPayment: async (orderCode: number) => {
        if (orderCode === failingOrderCode) {
          throw new Error('PayOS responded with HTTP 400');
        }
        return ok;
      },
      createCheckout: async () => {
        throw new Error('createCheckout is not exercised by these tests');
      },
      cancelPayment: async () => ok,
    };
    return new BillingRepository(provider);
  }

  function snapshotFor(
    seeded: SeededAttempt,
    overrides: Partial<ProviderPaymentSnapshot>,
  ): ProviderPaymentSnapshot {
    return {
      id: seeded.paymentLinkId,
      orderCode: seeded.orderCode,
      amount: PRICE,
      amountPaid: 0,
      amountRemaining: PRICE,
      currency: 'VND',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      transactions: [],
      ...overrides,
    };
  }

  async function seedAttempt(options: SeedAttemptOptions): Promise<SeededAttempt> {
    const orderId = new Types.ObjectId();
    const attemptId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const publicId = randomUUID();
    const orderCode = (codeSeed += 1);
    const paymentLinkId = `link-${publicId}`;
    orderIds.push(orderId);

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
      receivedAmount: 0,
      excessAmount: 0,
      durationUnit: 'month',
      durationValue: 1,
      pricingVersion: 1,
      termsVersion: '2026-07-23',
      collectionStatus: 'unpaid',
    });
    await PaymentAttempt.create({
      _id: attemptId,
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
      collectionStatus: options.attemptStatus,
      activeForCheckout: options.activeForCheckout,
      createOutcome: 'created',
      expiresAt: options.expiresAt,
      nextReconcileAt: new Date(Date.now() - 1_000),
      ...(options.terminalConfirmedAt === undefined
        ? {}
        : { terminalConfirmedAt: options.terminalConfirmedAt }),
    });

    return { orderId, attemptId, publicId, orderCode, userId: userId.toString(), paymentLinkId };
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Reconciliation integration database is unavailable', { cause: error });
    }
  }, 15_000);

  beforeEach(() => {
    vi.stubEnv('PAYOS_PROVIDER_ACCOUNT_ID', PROVIDER_ACCOUNT);
    // Keep fulfilment out of these assertions: they are about money visibility.
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

  it('records a part payment that lands on a cancelled attempt', async () => {
    const seeded = await seedAttempt({
      attemptStatus: 'cancelled',
      activeForCheckout: false,
      expiresAt: new Date(Date.now() - 60_000),
      terminalConfirmedAt: new Date(Date.now() - 60_000),
    });
    const repository = repositoryReturning(
      snapshotFor(seeded, {
        status: 'CANCELLED',
        amountPaid: 40_000,
        amountRemaining: 60_000,
        transactions: [
          {
            reference: `late-${seeded.publicId}`,
            amount: 40_000,
            transactionDateTime: new Date().toISOString(),
          },
        ],
      }),
    );

    const view = await repository.verifyOrder(seeded.userId, seeded.publicId);

    // Previously the rank ladder refused partial < cancelled, so the order kept
    // receivedAmount 0 while a real transaction sat in the ledger.
    expect(view.receivedAmount).toBe(40_000);
    expect(view.collectionStatus).toBe('partial');

    const attempt = await PaymentAttempt.findById(seeded.attemptId)
      .lean<{ collectionStatus: string; activeForCheckout: boolean }>()
      .exec();
    expect(attempt?.collectionStatus).toBe('review');
    // A closed attempt must never be re-opened: the order's unique
    // active-for-checkout slot may already belong to a replacement.
    expect(attempt?.activeForCheckout).toBe(false);
    await expect(PaymentTransaction.countDocuments({ order: seeded.orderId })).resolves.toBe(1);
  });

  it('still settles a full payment that lands on a cancelled attempt', async () => {
    const seeded = await seedAttempt({
      attemptStatus: 'cancelled',
      activeForCheckout: false,
      expiresAt: new Date(Date.now() - 60_000),
      terminalConfirmedAt: new Date(Date.now() - 60_000),
    });
    const repository = repositoryReturning(
      snapshotFor(seeded, {
        status: 'PAID',
        amountPaid: PRICE,
        amountRemaining: 0,
        transactions: [
          {
            reference: `full-${seeded.publicId}`,
            amount: PRICE,
            transactionDateTime: new Date().toISOString(),
          },
        ],
      }),
    );

    const view = await repository.verifyOrder(seeded.userId, seeded.publicId);

    expect(view.receivedAmount).toBe(PRICE);
    expect(view.collectionStatus).toBe('paid');
    const attempt = await PaymentAttempt.findById(seeded.attemptId)
      .lean<{ collectionStatus: string }>()
      .exec();
    expect(attempt?.collectionStatus).toBe('paid');
  });

  it('closes a lapsed unpaid attempt the provider still reports as pending', async () => {
    const seeded = await seedAttempt({
      attemptStatus: 'pending',
      activeForCheckout: true,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const repository = repositoryReturning(snapshotFor(seeded, { status: 'PENDING' }));

    const view = await repository.verifyOrder(seeded.userId, seeded.publicId);

    expect(view.attemptCollectionStatus).toBe('expired');
    expect(view.checkoutUrl).toBeUndefined();
    const attempt = await PaymentAttempt.findById(seeded.attemptId)
      .lean<{ activeForCheckout: boolean; terminalConfirmedAt?: Date }>()
      .exec();
    expect(attempt?.activeForCheckout).toBe(false);
    // Needed by the replacement-attempt path, which waits on this timestamp.
    expect(attempt?.terminalConfirmedAt).toBeInstanceOf(Date);
  });

  it('withholds the checkout link once the deadline passes, before reconciling', async () => {
    const seeded = await seedAttempt({
      attemptStatus: 'pending',
      activeForCheckout: true,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const repository = repositoryReturning(snapshotFor(seeded, {}));

    // Plain read, no provider call: the deadline alone must hide the link.
    const view = await repository.getOrderByPublicId(seeded.userId, seeded.publicId);
    expect(view.checkoutUrl).toBeUndefined();
    expect(view.attemptExpiresAt).toBeDefined();
    expect(view.activeAttemptId).toBe(seeded.attemptId.toString());
  });

  it('keeps advertising a link that has not lapsed yet', async () => {
    const seeded = await seedAttempt({
      attemptStatus: 'pending',
      activeForCheckout: true,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const repository = repositoryReturning(snapshotFor(seeded, {}));

    const view = await repository.getOrderByPublicId(seeded.userId, seeded.publicId);
    expect(view.checkoutUrl).toBe(`https://pay.payos.vn/web/${seeded.paymentLinkId}`);
  });

  it('keeps draining after an attempt the provider cannot answer for', async () => {
    // Reproduces a production incident: one attempt whose order code PayOS
    // rejected made the whole batch return 500. `reconcileAttempt` throws before
    // it writes anything, so that attempt stayed first in the queue and every
    // later attempt — and the promo reservation release after the loop — was
    // blocked, every minute, indefinitely.
    const poisoned = await seedAttempt({
      attemptStatus: 'pending',
      activeForCheckout: true,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const healthy = await seedAttempt({
      attemptStatus: 'pending',
      activeForCheckout: true,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    const repository = repositoryThatFailsFor(
      poisoned.orderCode,
      snapshotFor(healthy, { status: 'PENDING' }),
    );

    const result = await repository.reconcileDueAttempts({ limit: 50 });
    expect(result.failed).toBeGreaterThanOrEqual(1);

    // Pushed out with the reason recorded, no longer blocking the head.
    const blocked = await PaymentAttempt.findById(poisoned.attemptId)
      .lean<{ nextReconcileAt: Date; lastProviderError?: string; reconcileCount: number }>()
      .exec();
    expect(blocked?.lastProviderError).toContain('HTTP 400');
    expect(blocked?.nextReconcileAt.getTime()).toBeGreaterThan(Date.now());
    expect(blocked?.reconcileCount).toBe(1);

    // The healthy attempt in the same batch was still reconciled.
    const moved = await PaymentAttempt.findById(healthy.attemptId)
      .lean<{ reconcileCount: number }>()
      .exec();
    expect(moved?.reconcileCount).toBeGreaterThanOrEqual(1);
  });
});
