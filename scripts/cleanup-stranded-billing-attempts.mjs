import process from 'node:process';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Retires payment attempts that can never be reconciled because their provider
 * link was never created, and releases everything they were holding.
 *
 * These are rows a local development run wrote into a production database: they
 * carry a different `providerAccountId` and `environment` than the deployment
 * that owns the data, and `createOutcome: 'not_started'` means the provider was
 * never successfully called. The provider therefore has no record of the order
 * code, so every reconciliation attempt fails against it forever — and because
 * such an attempt sorts first in the reconcile queue, it blocks every other
 * attempt behind it.
 *
 * The end state matches what `failOrderCreation` writes for a link that could
 * not be created: the attempt becomes a definite failure, the promo reservation
 * is released, the idempotency record is marked failed, and the order stays
 * `unpaid` — which is the truth, since no money was ever collected.
 *
 * Dry run by default. Refuses to touch anything that has money against it.
 *
 *   node scripts/cleanup-stranded-billing-attempts.mjs
 *   node scripts/cleanup-stranded-billing-attempts.mjs --apply
 */

const apply = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required.');
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
await client.connect();
const db = client.db();

const orders = db.collection('billingorders');
const attempts = db.collection('paymentattempts');
const transactions = db.collection('paymenttransactions');
const redemptions = db.collection('promotionredemptions');
const promotions = db.collection('promotions');
const userCounters = db.collection('promotionusercounters');
const claims = db.collection('firstpurchaseclaims');
const idempotency = db.collection('idempotencyrecords');

/** The provider identity the running deployment actually owns. */
const liveAccounts = await attempts.distinct('providerAccountId', {
  environment: 'production',
  createOutcome: 'created',
});

const candidates = await attempts
  .find({
    collectionStatus: { $in: ['creating', 'pending', 'partial', 'review'] },
    createOutcome: 'not_started',
    amountPaid: 0,
    providerAccountId: { $nin: liveAccounts },
  })
  .toArray();

console.log(`${apply ? 'APPLY' : 'DRY RUN'} — live provider accounts: ${liveAccounts.join(', ')}`);
console.log(`stranded attempt candidates: ${candidates.length}\n`);

let retired = 0;
let skipped = 0;

for (const attempt of candidates) {
  const order = await orders.findOne({ _id: attempt.order });
  const money = await transactions.countDocuments({ order: attempt.order });
  const label = `attempt=${attempt._id} order=${attempt.order} code=${order?.orderCode ?? '?'}`;

  // Fail closed around money: anything with a captured transaction, a non-zero
  // received amount, or an order past `unpaid` is a real payment and must be
  // looked at by a person, not swept by a script.
  if (
    money > 0 ||
    (order?.receivedAmount ?? 0) > 0 ||
    (order && order.collectionStatus !== 'unpaid')
  ) {
    console.log(
      `SKIP ${label} — has money or is past unpaid (transactions=${money},` +
        ` received=${order?.receivedAmount}, collection=${order?.collectionStatus})`,
    );
    skipped += 1;
    continue;
  }

  console.log(`RETIRE ${label}`);
  console.log(
    `   attempt: ${attempt.collectionStatus}/${attempt.createOutcome}` +
      ` env=${attempt.environment} acct=${attempt.providerAccountId} created=${attempt.createdAt?.toISOString?.()}`,
  );

  const redemption = await redemptions.findOne({ order: attempt.order, status: 'reserved' });
  if (redemption) {
    const promotion = await promotions.findOne({ _id: redemption.promotion });
    const counter = await userCounters.findOne({
      promotion: redemption.promotion,
      user: redemption.user,
    });
    console.log(
      `   promo reservation: promotion=${redemption.promotion}` +
        ` promotion.reservedCount=${promotion?.reservedCount} userCounter.reservedCount=${counter?.reservedCount}`,
    );
  }
  const stuckIdempotency = await idempotency.countDocuments({
    order: attempt.order,
    status: 'processing',
  });
  if (stuckIdempotency > 0) console.log(`   idempotency records to fail: ${stuckIdempotency}`);

  if (!apply) {
    retired += 1;
    continue;
  }

  const now = new Date();
  const reason = 'Provider link was never created; attempt belongs to a foreign provider account';

  if (redemption) {
    await promotions.updateOne(
      { _id: redemption.promotion, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
    await userCounters.updateOne(
      { promotion: redemption.promotion, user: redemption.user, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
    await redemptions.updateOne(
      { _id: redemption._id, status: 'reserved' },
      { $set: { status: 'released', releasedAt: now, releaseReason: 'stranded_attempt_cleanup' } },
    );
    await claims.updateOne(
      { order: attempt.order, status: 'reserved' },
      { $set: { status: 'released', releasedAt: now, releaseReason: 'stranded_attempt_cleanup' } },
    );
  }

  await attempts.updateOne(
    { _id: attempt._id, amountPaid: 0 },
    {
      $set: {
        collectionStatus: 'failed',
        createOutcome: 'definite_failure',
        activeForCheckout: false,
        terminalConfirmedAt: now,
        lastProviderError: reason,
      },
      $inc: { version: 1 },
    },
  );

  await idempotency.updateMany(
    { order: attempt.order, status: 'processing' },
    {
      $set: {
        status: 'failed_deterministic',
        responseStatus: 422,
        responseBodySnapshot: { code: 'payment_create_failed', message: reason },
      },
    },
  );

  retired += 1;
}

console.log(`\n${apply ? 'retired' : 'would retire'}: ${retired} | skipped: ${skipped}`);
if (!apply && retired > 0) console.log('Re-run with --apply to write these changes.');

await client.close();
