import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { PaymentWebhookInbox } from '@/models/Billing';
import type { InboxLease } from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingSettlementRepository } from '@/repositories/billing/BillingSettlementRepository';
import { WebhookInboxRepository } from '@/repositories/billing/WebhookInboxRepository';
import { INBOX_LEASE_MS } from '@/services/billing/domain/schedule';
import { integrationDatabaseUri } from '../../setup/integration-db';

interface StoredInbox {
  status: string;
  attemptCount: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  leaseToken?: string;
  lastError?: string;
  replayedAt?: Date;
}

/**
 * The webhook inbox is a queue, and a queue without a fence is a queue where
 * two workers process the same row and the slower one's verdict wins.
 *
 * The claim mints a token; every write that belongs to that claim carries it.
 * A worker whose lease lapsed and was reclaimed matches nothing — it cannot
 * mark the row processed, and it cannot push it back out with a schedule the
 * new owner did not choose. None of that can be shown against an in-memory
 * double, because the fence *is* the filter on the update.
 */
describe('webhook inbox lease integration', () => {
  const settlement = new BillingSettlementRepository();
  const inbox = new WebhookInboxRepository();
  const inboxIds: Types.ObjectId[] = [];
  let codeSeed = Date.now() * 100;

  async function seedDelivery(overrides: Record<string, unknown> = {}): Promise<Types.ObjectId> {
    const id = new Types.ObjectId();
    inboxIds.push(id);
    await PaymentWebhookInbox.create({
      _id: id,
      provider: 'payos',
      providerAccountId: 'inbox-lease-account',
      environment: 'test',
      dedupKey: `dedup-${randomUUID()}`,
      orderCode: (codeSeed += 1),
      verificationClass: 'accepted',
      status: 'verified',
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1_000),
      rawPayloadHash: randomUUID(),
      byteSizeBytes: 128,
      ...overrides,
    });
    return id;
  }

  async function read(id: Types.ObjectId): Promise<StoredInbox> {
    const row = await PaymentWebhookInbox.findById(id).lean<StoredInbox>().exec();
    if (!row) throw new Error('Seeded inbox row disappeared');
    return row;
  }

  /**
   * Claims rows until the wanted one comes back. The drain takes the oldest
   * due row, and other suites share this database, so a claim cannot be aimed
   * at a particular row — it has to be drained to.
   */
  async function claimUntil(
    nowMs: number,
    wanted: (inboxRef: string) => boolean,
  ): Promise<InboxLease> {
    for (let index = 0; index < 40; index += 1) {
      const claim = await settlement.inInboxTransaction((tx) =>
        tx.claim({ nowMs, leaseMs: INBOX_LEASE_MS }),
      );
      if (claim === null) break;
      if (wanted(claim.lease.inboxRef)) return claim.lease;
    }
    throw new Error('The wanted inbox row was not claimable');
  }

  /** Claims rows until one of this file's own comes back. */
  function claimOwn(nowMs: number): Promise<InboxLease> {
    const mine = new Set(inboxIds.map((id) => id.toString()));
    return claimUntil(nowMs, (inboxRef) => mine.has(inboxRef));
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Webhook inbox integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await PaymentWebhookInbox.deleteMany({ _id: { $in: inboxIds } });
    await mongoose.disconnect();
  }, 15_000);

  it('leases a due row and counts the attempt against it', async () => {
    const nowMs = Date.now();
    const id = await seedDelivery();

    const lease = await claimOwn(nowMs);

    const stored = await read(new Types.ObjectId(lease.inboxRef));
    expect(stored.status).toBe('processing');
    expect(stored.leaseToken).toBe(lease.token);
    expect(stored.attemptCount).toBe(1);
    expect(inboxIds.map((each) => each.toString())).toContain(id.toString());
  });

  it('hides a leased row from the next overlapping drain', async () => {
    const nowMs = Date.now();
    await seedDelivery();
    const lease = await claimOwn(nowMs);

    const second = await settlement.inInboxTransaction((tx) =>
      tx.claim({ nowMs: nowMs + 1_000, leaseMs: INBOX_LEASE_MS }),
    );

    expect(second?.lease.inboxRef).not.toBe(lease.inboxRef);
  });

  describe('a worker whose inbox lease was reclaimed', () => {
    /** Claims a row, lets the lease lapse, and lets a second worker take it. */
    async function reclaimed(): Promise<{ stale: InboxLease; live: InboxLease }> {
      const nowMs = Date.now();
      await seedDelivery();
      const stale = await claimOwn(nowMs);
      const laterMs = nowMs + INBOX_LEASE_MS + 1;
      const live = await claimUntil(laterMs, (inboxRef) => inboxRef === stale.inboxRef);
      return { stale, live };
    }

    it('cannot mark the row processed under the new owner', async () => {
      const { stale } = await reclaimed();

      const outcome = await settlement.inInboxTransaction((tx) => tx.markProcessed(stale));

      expect(outcome).toBe('lease_lost');
      // Still `processing`, still owned by the worker that reclaimed it: the
      // stale worker's verdict said nothing about the run now in flight.
      expect((await read(new Types.ObjectId(stale.inboxRef))).status).toBe('processing');
    });

    it('cannot push the row back out on a schedule the new owner did not choose', async () => {
      const { stale } = await reclaimed();
      const before = await read(new Types.ObjectId(stale.inboxRef));

      const outcome = await settlement.inInboxTransaction((tx) =>
        tx.reschedule({
          lease: stale,
          status: 'dead_letter',
          nextAttemptAtMs: Date.now() + 86_400_000,
          lastError: 'a verdict about a world that has moved on',
        }),
      );

      expect(outcome).toBe('lease_lost');
      const after = await read(new Types.ObjectId(stale.inboxRef));
      expect(after.status).toBe(before.status);
      expect(after.lastError).toBeUndefined();
    });

    it('still lets the live owner finish the row', async () => {
      const { live } = await reclaimed();

      const outcome = await settlement.inInboxTransaction((tx) => tx.markProcessed(live));

      expect(outcome).toBe('applied');
      const stored = await read(new Types.ObjectId(live.inboxRef));
      expect(stored.status).toBe('processed');
      expect(stored.leaseToken).toBeUndefined();
    });

    it('counts the attempt once per claim, so a reclaim is not free', async () => {
      // The attempt budget is what eventually dead-letters a poison event. A
      // reclaim that did not count would let one row retry forever.
      const { stale } = await reclaimed();
      expect((await read(new Types.ObjectId(stale.inboxRef))).attemptCount).toBe(2);
    });
  });

  describe('an operator replaying a stalled row', () => {
    it('clears the lease and the spent attempt budget together', async () => {
      const admin = new Types.ObjectId().toString();
      const id = await seedDelivery({
        status: 'dead_letter',
        attemptCount: 12,
        leaseUntil: new Date(Date.now() + 60_000),
        leaseToken: 'a-token-from-a-worker-long-gone',
        nextAttemptAt: new Date(Date.now() + 86_400_000),
      });

      const requeued = await inbox.requeue({
        inboxRef: id.toString(),
        fromStatuses: ['dead_letter'],
        nowMs: Date.now(),
        replayedBy: admin,
      });

      expect(requeued).toBe(true);
      const stored = await read(id);
      expect(stored.status).toBe('verified');
      // A lease left behind would hold the row out of the queue for its full
      // duration, so a replay that did not clear it would do nothing at all.
      expect(stored.leaseToken).toBeUndefined();
      expect(stored.leaseUntil).toBeUndefined();
      expect(stored.attemptCount).toBe(0);
      expect(stored.replayedAt).toBeInstanceOf(Date);
      expect(stored.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('produces one replay when two operators press it together', async () => {
      const admin = new Types.ObjectId().toString();
      const id = await seedDelivery({ status: 'dead_letter', attemptCount: 12 });

      const outcomes = await Promise.all([
        inbox.requeue({
          inboxRef: id.toString(),
          fromStatuses: ['dead_letter'],
          nowMs: Date.now(),
          replayedBy: admin,
        }),
        inbox.requeue({
          inboxRef: id.toString(),
          fromStatuses: ['dead_letter'],
          nowMs: Date.now(),
          replayedBy: admin,
        }),
      ]);

      expect(outcomes.filter(Boolean)).toHaveLength(1);
    });

    it('refuses to requeue a row that is not in a replayable state', async () => {
      const admin = new Types.ObjectId().toString();
      const id = await seedDelivery({ status: 'processed' });

      await expect(
        inbox.requeue({
          inboxRef: id.toString(),
          fromStatuses: ['dead_letter', 'retryable_failure', 'orphaned', 'permanent_failure'],
          nowMs: Date.now(),
          replayedBy: admin,
        }),
      ).resolves.toBe(false);
    });

    it('hands a retained body over still sealed', async () => {
      // A read that quietly decrypted on the way past would make the audited
      // reveal endpoint pointless: the listing would already be the disclosure.
      const id = await seedDelivery({
        status: 'dead_letter',
        verificationClass: 'unsupported_schema',
        orderCode: null,
        encryptedRawPayload: {
          ciphertext: 'Y2lwaGVy',
          iv: 'aXZpdml2aXZpdml2aQ==',
          authTag: 'dGFndGFndGFndGFndGFndGFn',
          keyVersion: 'v1',
        },
      });

      const row = await inbox.findRow(id.toString());

      expect(row?.sealedPayload).toMatchObject({ keyVersion: 'v1', ciphertext: 'Y2lwaGVy' });
      expect(row?.orderCode).toBeNull();
    });

    it('reports an id that is not a row rather than throwing', async () => {
      await expect(inbox.findRow('not-an-object-id')).resolves.toBeNull();
      await expect(inbox.findRow(new Types.ObjectId().toString())).resolves.toBeNull();
    });
  });
});
