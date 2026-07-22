import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;
const MIGRATION_COMMENT = 'migrate-subscription-plan-reference-v1';

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function planForReference(plansById, planId, context) {
  const plan = plansById.get(planId);
  if (!plan) throw new Error(`${context} references missing plan ${planId}`);
  return plan;
}

export function classifyPlanReference(reference, plansById, context) {
  const hasLegacyType = hasOwn(reference, 'type');
  const hasPlanId = hasOwn(reference, 'planId');
  const hasPlanName = hasOwn(reference, 'planName');

  if (!hasLegacyType && !hasPlanId && !hasPlanName) {
    throw new Error(`${context} has no plan reference`);
  }

  const legacyType = hasLegacyType
    ? requireNonEmptyString(reference.type, `${context}.type`)
    : undefined;
  const planId = hasPlanId
    ? requireNonEmptyString(reference.planId, `${context}.planId`)
    : legacyType;
  if (!planId) throw new Error(`${context} is missing planId`);
  if (legacyType !== undefined && legacyType !== planId) {
    throw new Error(`${context} has conflicting type and planId`);
  }

  const plan = planForReference(plansById, planId, context);
  if (hasPlanName) requireNonEmptyString(reference.planName, `${context}.planName`);

  const canonical = !hasLegacyType && hasPlanId && hasPlanName;
  if (canonical) return { kind: 'clean', planId, planName: reference.planName };
  return { kind: 'migrate', planId, planName: plan.name };
}

function stablePlanSha(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

async function buildMigrationPlan(db) {
  const planDocuments = await db
    .collection('plans')
    .find({}, { projection: { _id: 1, name: 1 } })
    .sort({ _id: 1 })
    .toArray();
  const plansById = new Map(
    planDocuments.map((plan) => [
      requireNonEmptyString(String(plan._id), 'plan._id'),
      { id: String(plan._id), name: requireNonEmptyString(plan.name, `plan.${plan._id}.name`) },
    ]),
  );

  const [subscriptions, users] = await Promise.all([
    db
      .collection('subscriptions')
      .find({}, { projection: { _id: 1, type: 1, planId: 1, planName: 1 } })
      .sort({ _id: 1 })
      .toArray(),
    db
      .collection('users')
      .find({ subscription: { $exists: true } }, { projection: { _id: 1, subscription: 1 } })
      .sort({ _id: 1 })
      .toArray(),
  ]);

  const subscriptionTargets = [];
  for (const subscription of subscriptions) {
    const result = classifyPlanReference(
      subscription,
      plansById,
      `subscription.${subscription._id}`,
    );
    if (result.kind === 'migrate') {
      subscriptionTargets.push({ id: subscription._id, ...result });
    }
  }

  const userTargets = [];
  for (const user of users) {
    const result = classifyPlanReference(
      user.subscription,
      plansById,
      `user.${user._id}.subscription`,
    );
    if (result.kind === 'migrate') userTargets.push({ id: user._id, ...result });
  }

  const summary = {
    planCount: plansById.size,
    subscriptionCount: subscriptions.length,
    subscriptionTargets: subscriptionTargets.map(({ id, planId, planName }) => ({
      id: String(id),
      planId,
      planName,
    })),
    userSubscriptionCount: users.length,
    userTargets: userTargets.map(({ id, planId, planName }) => ({
      id: String(id),
      planId,
      planName,
    })),
  };
  return { ...summary, subscriptionTargets, userTargets, planSha: stablePlanSha(summary) };
}

async function applyMigration(db, plan) {
  if (plan.subscriptionTargets.length > 0) {
    const result = await db.collection('subscriptions').bulkWrite(
      plan.subscriptionTargets.map((target) => ({
        updateOne: {
          filter: { _id: target.id, type: target.planId },
          update: {
            $set: { planId: target.planId, planName: target.planName },
            $unset: { type: '' },
          },
        },
      })),
      { ordered: true, comment: MIGRATION_COMMENT },
    );
    if (result.matchedCount !== plan.subscriptionTargets.length) {
      throw new Error('Subscription data changed after dry-run; no partial result is accepted');
    }
  }

  if (plan.userTargets.length > 0) {
    const result = await db.collection('users').bulkWrite(
      plan.userTargets.map((target) => ({
        updateOne: {
          filter: { _id: target.id, 'subscription.type': target.planId },
          update: {
            $set: {
              'subscription.planId': target.planId,
              'subscription.planName': target.planName,
            },
            $unset: { 'subscription.type': '' },
          },
        },
      })),
      { ordered: true, comment: MIGRATION_COMMENT },
    );
    if (result.matchedCount !== plan.userTargets.length) {
      throw new Error(
        'User subscription data changed after dry-run; no partial result is accepted',
      );
    }
  }
}

async function verifyMigration(db) {
  const plan = await buildMigrationPlan(db);
  if (plan.subscriptionTargets.length > 0 || plan.userTargets.length > 0) {
    throw new Error('Migration verification failed: legacy plan references remain');
  }
  return plan;
}

async function main() {
  const mode = process.argv.includes('--apply')
    ? 'apply'
    : process.argv.includes('--verify')
      ? 'verify'
      : 'plan';
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    if (mode === 'verify') {
      const verified = await verifyMigration(db);
      console.log(JSON.stringify({ mode, verified: true, planSha: verified.planSha }, null, 2));
      return;
    }

    const plan = await buildMigrationPlan(db);
    console.log(
      JSON.stringify(
        {
          mode,
          planSha: plan.planSha,
          subscriptionCount: plan.subscriptionCount,
          subscriptionUpdates: plan.subscriptionTargets.length,
          userSubscriptionCount: plan.userSubscriptionCount,
          userUpdates: plan.userTargets.length,
        },
        null,
        2,
      ),
    );
    if (mode === 'apply') {
      await applyMigration(db, plan);
      const verified = await verifyMigration(db);
      console.log(
        JSON.stringify({ applied: true, verified: true, planSha: verified.planSha }, null, 2),
      );
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
