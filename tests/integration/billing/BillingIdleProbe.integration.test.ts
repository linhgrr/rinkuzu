import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { PaymentWebhookInbox } from '@/models/Billing';
import { BillingIdleProbeRepository } from '@/repositories/billing/BillingIdleProbeRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * The idle check the inbox tick exits on (RIN-1625). Other suites share this
 * database and leave due rows behind, so the probe is asked about a moment in
 * 1999: only the row seeded here can be due then, and nothing can be due a
 * year before it.
 */
describe('billing idle probe integration', () => {
  const probe = new BillingIdleProbeRepository();
  const inboxIds: Types.ObjectId[] = [];
  const dueAt = new Date('1999-12-31T00:00:00Z');

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Billing idle probe integration database is unavailable', { cause: error });
    }
    const id = new Types.ObjectId();
    inboxIds.push(id);
    await PaymentWebhookInbox.create({
      _id: id,
      provider: 'payos',
      providerAccountId: 'idle-probe-account',
      environment: 'test',
      dedupKey: `dedup-${randomUUID()}`,
      orderCode: Date.now() * 100,
      verificationClass: 'accepted',
      status: 'verified',
      attemptCount: 0,
      nextAttemptAt: dueAt,
      rawPayloadHash: randomUUID(),
      byteSizeBytes: 128,
    });
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await PaymentWebhookInbox.deleteMany({ _id: { $in: inboxIds } });
    await mongoose.disconnect();
  });

  it('says nothing is due before the row is', async () => {
    await expect(probe.hasDueInboxWork(Date.parse('1999-01-01T00:00:00Z'))).resolves.toBe(false);
  });

  it('sees a verified row once it is due, the same row the drain would claim', async () => {
    await expect(probe.hasDueInboxWork(dueAt.getTime() + 1_000)).resolves.toBe(true);
  });
});
