import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import {
  BillingOrder,
  PaymentAttempt,
  PaymentTransaction,
  PaymentWebhookInbox,
} from '@/models/Billing';
import { AdminBillingOrdersRepository } from '@/repositories/AdminBillingOrdersRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

interface SeedOptions {
  collectionStatus?: string;
  fulfillmentStatus?: string;
  settlementStatus?: string;
  excessResolution?: string;
  receivedAmount?: number;
}

/**
 * The operator work queue is only useful if its filter and its counters agree
 * with the states the pipeline actually parks orders in. This exercises both
 * against real documents.
 */
describe('admin billing orders integration', () => {
  const repository = new AdminBillingOrdersRepository();
  const runId = randomUUID().slice(0, 8);
  const orderIds: Types.ObjectId[] = [];
  const userIds: Types.ObjectId[] = [];
  const inboxIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  async function seedOrder(options: SeedOptions = {}): Promise<{
    orderId: Types.ObjectId;
    publicId: string;
    orderCode: number;
    userId: Types.ObjectId;
    email: string;
  }> {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const publicId = randomUUID();
    const orderCode = (codeSeed += 1);
    const email = `admin-orders-${runId}-${orderIds.length}@example.test`;
    orderIds.push(orderId);
    userIds.push(userId);

    await mongoose.connection.collection('users').insertOne({
      _id: userId,
      email,
      role: 'user',
      disable: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await BillingOrder.create({
      _id: orderId,
      publicId,
      orderCode,
      user: userId,
      planId: 'plan_premium_1m',
      planName: 'Premium 1 tháng',
      currency: 'VND',
      baseAmount: 100_000,
      discountAmount: 0,
      finalAmount: 100_000,
      receivedAmount: options.receivedAmount ?? 0,
      excessAmount: 0,
      durationUnit: 'month',
      durationValue: 1,
      pricingVersion: 1,
      termsVersion: '2026-07-23',
      collectionStatus: options.collectionStatus ?? 'unpaid',
      fulfillmentStatus: options.fulfillmentStatus ?? 'unfulfilled',
      settlementStatus: options.settlementStatus ?? 'unsettled',
      excessResolution: options.excessResolution ?? 'none',
    });
    await PaymentAttempt.create({
      order: orderId,
      provider: 'payos',
      providerAccountId: `acct-${runId}`,
      environment: 'test',
      currency: 'VND',
      requestedAmount: 100_000,
      amountPaid: options.receivedAmount ?? 0,
      amountRemaining: 100_000 - (options.receivedAmount ?? 0),
      collectionStatus: options.collectionStatus === 'unpaid' ? 'pending' : 'paid',
      expiresAt: new Date(Date.now() + 60_000),
    });
    return { orderId, publicId, orderCode, userId, email };
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Admin billing orders integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      PaymentTransaction.deleteMany({ order: { $in: orderIds } }),
      PaymentAttempt.deleteMany({ order: { $in: orderIds } }),
      BillingOrder.deleteMany({ _id: { $in: orderIds } }),
      PaymentWebhookInbox.deleteMany({ _id: { $in: inboxIds } }),
      mongoose.connection.collection('users').deleteMany({ _id: { $in: userIds } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('puts a part-paid order in the attention bucket and out of unpaid', async () => {
    const seeded = await seedOrder({ collectionStatus: 'partial', receivedAmount: 40_000 });

    const attention = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'attention',
      search: seeded.publicId,
    });
    expect(attention.items).toHaveLength(1);
    expect(attention.items[0]?.publicId).toBe(seeded.publicId);
    expect(attention.items[0]?.receivedAmount).toBe(40_000);
    // The latest attempt status is joined in so the operator sees both layers.
    expect(attention.items[0]?.attemptCollectionStatus).toBeDefined();

    const unpaid = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'unpaid',
      search: seeded.publicId,
    });
    expect(unpaid.items).toHaveLength(0);
  });

  it('treats paid-but-unfulfilled as attention-worthy only via the fulfilment review flag', async () => {
    // Paid and awaiting fulfilment is normal in-flight state, not attention.
    const inFlight = await seedOrder({
      collectionStatus: 'paid',
      fulfillmentStatus: 'processing',
      receivedAmount: 100_000,
    });
    const stuck = await seedOrder({
      collectionStatus: 'paid',
      fulfillmentStatus: 'review',
      receivedAmount: 100_000,
    });

    const inFlightRows = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'attention',
      search: inFlight.publicId,
    });
    expect(inFlightRows.items).toHaveLength(0);

    const stuckRows = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'attention',
      search: stuck.publicId,
    });
    expect(stuckRows.items).toHaveLength(1);
  });

  it('separates the fulfilment backlog alarm from the human review queue', async () => {
    const before = await repository.health();

    // Still moving through the pipeline: this is the silent-revenue-loss alarm
    // and matches what the background fulfilment sweep will pick up.
    await seedOrder({
      collectionStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      receivedAmount: 100_000,
    });
    // Parked for a human decision (e.g. a refund was recorded against it), so
    // it belongs to the attention queue, not the backlog alarm.
    await seedOrder({
      collectionStatus: 'paid',
      fulfillmentStatus: 'review',
      receivedAmount: 100_000,
    });

    const after = await repository.health();
    expect(after.paidButUnfulfilled).toBe(before.paidButUnfulfilled + 1);
    expect(after.ordersNeedingAttention).toBe(before.ordersNeedingAttention + 1);
  });

  it('finds an order by provider order code and by buyer email', async () => {
    const seeded = await seedOrder({ collectionStatus: 'unpaid' });

    const byCode = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'all',
      search: String(seeded.orderCode),
    });
    expect(byCode.items.map((row) => row.publicId)).toContain(seeded.publicId);

    const byEmail = await repository.listOrders({
      page: 1,
      limit: 100,
      bucket: 'all',
      search: seeded.email,
    });
    expect(byEmail.items.map((row) => row.publicId)).toEqual([seeded.publicId]);
    expect(byEmail.items[0]?.userEmail).toBe(seeded.email);
  });

  it('counts stuck webhook inbox rows in the health snapshot', async () => {
    const before = await repository.health();
    const created = await PaymentWebhookInbox.create({
      provider: 'payos',
      providerAccountId: `acct-${runId}`,
      environment: 'test',
      dedupKey: `orphan-${randomUUID()}`,
      rawPayloadHash: randomUUID(),
      status: 'orphaned',
    });
    inboxIds.push(created._id as Types.ObjectId);

    const after = await repository.health();
    expect(after.inboxOrphaned).toBe(before.inboxOrphaned + 1);
  });

  it('returns provider facts and entitlement state for one order', async () => {
    const seeded = await seedOrder({ collectionStatus: 'paid', receivedAmount: 100_000 });
    await PaymentTransaction.create({
      provider: 'payos',
      providerAccountId: `acct-${runId}`,
      environment: 'test',
      transactionType: 'payment',
      externalReference: `ref-${seeded.publicId}`,
      attempt: new Types.ObjectId(),
      order: seeded.orderId,
      currency: 'VND',
      signedAmount: 100_000,
      direction: 'incoming',
      providerEventAt: new Date(),
      rawPayloadHash: randomUUID(),
    });

    const detail = await repository.findOrderDetail(seeded.publicId);
    expect(detail?.order.publicId).toBe(seeded.publicId);
    expect(detail?.order.userEmail).toBe(seeded.email);
    expect(detail?.attempts).toHaveLength(1);
    expect(detail?.transactions).toHaveLength(1);
    expect(detail?.transactions[0]?.externalReference).toBe(`ref-${seeded.publicId}`);
    // No grant was appended for this order, which is exactly what an operator
    // needs to see on a paid order.
    expect(detail?.entitlement.granted).toBe(false);
  });

  it('returns null for an unknown public id', async () => {
    await expect(repository.findOrderDetail(randomUUID())).resolves.toBeNull();
  });
});
