import { createHash } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;

export const LIFETIME_PLAN_ID = 'plan_482c7639-0a9f-4efb-b1b4-6ec282344661';
export const MONTHLY_PLAN_ID = 'plan_281598b4-f008-4f16-b0b0-2944ff2e9e4c';
const MIGRATION_COMMENT = 'migrate-remove-lifetime-plan-v1';
const DEFAULT_MAX_DOCUMENTS = 20;
const MONTHLY_PLAN = {
  name: 'Premium 1 tháng',
  price: 39_000,
  duration: 'P1M',
  isActive: true,
  features: [
    'Tạo quiz riêng tư',
    'Ask Rin-chan: 150 lần/ngày',
    'Trích xuất quiz từ PDF: 50 lần/tháng',
    'Tạo lộ trình thích ứng: 12 lần/tháng',
    'Tạo bài tập thích ứng: 500 lần/ngày',
    'PDF lộ trình tối đa 100 trang',
  ],
};

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeDocument(document) {
  if (!document) return null;
  return JSON.parse(JSON.stringify(document));
}

function isAdminGrant(subscription) {
  return (
    typeof subscription.payosOrderId === 'string' &&
    subscription.payosOrderId.startsWith('admin_') &&
    typeof subscription.payosTransactionId === 'string' &&
    subscription.payosTransactionId.startsWith('admin_')
  );
}

export function buildLifetimeRemovalPlan({ lifetimePlan, monthlyPlan, subscriptions, users }) {
  const normalized = {
    lifetimePlan: normalizeDocument(lifetimePlan),
    monthlyPlan: normalizeDocument(monthlyPlan),
    subscriptions: subscriptions.map(normalizeDocument).sort((a, b) => a._id.localeCompare(b._id)),
    users: users.map(normalizeDocument).sort((a, b) => a._id.localeCompare(b._id)),
  };
  const realCompletedPurchases = normalized.subscriptions.filter(
    (subscription) => subscription.status === 'completed' && !isAdminGrant(subscription),
  );
  const affectedDocuments =
    (normalized.lifetimePlan ? 1 : 0) +
    normalized.subscriptions.length +
    normalized.users.length +
    (stableJson(normalized.monthlyPlan) === stableJson({ _id: MONTHLY_PLAN_ID, ...MONTHLY_PLAN })
      ? 0
      : 1);
  const planSha = createHash('sha256').update(stableJson(normalized)).digest('hex');

  return {
    ...normalized,
    realCompletedPurchases,
    affectedDocuments,
    planSha,
  };
}

export function validateLifetimeRemovalPlan(plan, maxDocuments) {
  if (!plan.monthlyPlan) throw new Error(`Required monthly plan ${MONTHLY_PLAN_ID} is missing`);
  if (plan.lifetimePlan && plan.lifetimePlan.duration !== 'PT0S') {
    throw new Error('Lifetime plan id points to a non-lifetime duration; refusing to delete it');
  }
  if (!plan.lifetimePlan && (plan.subscriptions.length > 0 || plan.users.length > 0)) {
    throw new Error('Lifetime plan is missing while references remain; refusing partial cleanup');
  }
  if (plan.realCompletedPurchases.length > 0) {
    throw new Error(
      `Found ${plan.realCompletedPurchases.length} completed non-admin lifetime purchase(s); manual reconciliation required`,
    );
  }
  if (plan.affectedDocuments > maxDocuments) {
    throw new Error(
      `Affected document count ${plan.affectedDocuments} exceeds --max-documents=${maxDocuments}`,
    );
  }
}

async function inspect(db, session) {
  const options = session ? { session } : {};
  const projection = {
    projection: { _id: 1, name: 1, price: 1, duration: 1, features: 1, isActive: 1 },
  };
  const lifetimePlan = await db
    .collection('plans')
    .findOne({ _id: LIFETIME_PLAN_ID }, { ...projection, ...options });
  const monthlyPlan = await db
    .collection('plans')
    .findOne({ _id: MONTHLY_PLAN_ID }, { ...projection, ...options });
  const subscriptions = await db
    .collection('subscriptions')
    .find(
      { type: LIFETIME_PLAN_ID },
      {
        ...options,
        projection: {
          _id: 1,
          user: 1,
          type: 1,
          amount: 1,
          status: 1,
          payosOrderId: 1,
          payosTransactionId: 1,
          startDate: 1,
          endDate: 1,
          isActive: 1,
        },
        sort: { _id: 1 },
      },
    )
    .toArray();
  const users = await db
    .collection('users')
    .find(
      { 'subscription.type': LIFETIME_PLAN_ID },
      { ...options, projection: { _id: 1, subscription: 1 }, sort: { _id: 1 } },
    )
    .toArray();

  return buildLifetimeRemovalPlan({ lifetimePlan, monthlyPlan, subscriptions, users });
}

async function assertPostcondition(db, session) {
  const options = session ? { session } : {};
  const lifetimePlanCount = await db
    .collection('plans')
    .countDocuments({ _id: LIFETIME_PLAN_ID }, options);
  const subscriptionReferenceCount = await db
    .collection('subscriptions')
    .countDocuments({ type: LIFETIME_PLAN_ID }, options);
  const userReferenceCount = await db
    .collection('users')
    .countDocuments({ 'subscription.type': LIFETIME_PLAN_ID }, options);
  const monthlyPlan = await db.collection('plans').findOne({ _id: MONTHLY_PLAN_ID }, options);

  if (lifetimePlanCount || subscriptionReferenceCount || userReferenceCount) {
    throw new Error(
      `Lifetime postcondition failed: plan=${lifetimePlanCount} subscriptions=${subscriptionReferenceCount} users=${userReferenceCount}`,
    );
  }
  for (const [key, expected] of Object.entries(MONTHLY_PLAN)) {
    if (stableJson(monthlyPlan?.[key]) !== stableJson(expected)) {
      throw new Error(`Monthly plan postcondition failed for ${key}`);
    }
  }

  return { lifetimePlanCount, subscriptionReferenceCount, userReferenceCount };
}

async function writeBackup(plan, backupDirectory) {
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await chmod(backupDirectory, 0o700);
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupPath = path.join(
    backupDirectory,
    `remove-lifetime-${timestamp}-${plan.planSha.slice(0, 12)}.json`,
  );
  await writeFile(
    backupPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        planSha: plan.planSha,
        lifetimePlan: plan.lifetimePlan,
        monthlyPlan: plan.monthlyPlan,
        subscriptions: plan.subscriptions,
        users: plan.users,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  await chmod(backupPath, 0o600);
  return backupPath;
}

async function applyMigration(client, db, approvedPlanSha, maxDocuments, backupDirectory) {
  const preflight = await inspect(db);
  validateLifetimeRemovalPlan(preflight, maxDocuments);
  if (preflight.planSha !== approvedPlanSha) {
    throw new Error(`Plan SHA changed; expected ${approvedPlanSha}, got ${preflight.planSha}`);
  }
  const backupPath = await writeBackup(preflight, backupDirectory);
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const transactionPlan = await inspect(db, session);
      validateLifetimeRemovalPlan(transactionPlan, maxDocuments);
      if (transactionPlan.planSha !== approvedPlanSha) {
        throw new Error('Plan changed after backup; transaction aborted');
      }

      await db
        .collection('users')
        .updateMany(
          { 'subscription.type': LIFETIME_PLAN_ID },
          { $unset: { subscription: '' } },
          { session, comment: MIGRATION_COMMENT },
        );
      await db
        .collection('subscriptions')
        .deleteMany({ type: LIFETIME_PLAN_ID }, { session, comment: MIGRATION_COMMENT });
      await db
        .collection('plans')
        .deleteOne(
          { _id: LIFETIME_PLAN_ID, duration: 'PT0S' },
          { session, comment: MIGRATION_COMMENT },
        );
      await db
        .collection('plans')
        .updateOne(
          { _id: MONTHLY_PLAN_ID },
          { $set: { ...MONTHLY_PLAN, updatedAt: new Date() } },
          { session, comment: MIGRATION_COMMENT },
        );
      await assertPostcondition(db, session);
    });
  } finally {
    await session.endSession();
  }

  return backupPath;
}

function readOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');
  if (apply && verifyOnly) throw new Error('Cannot combine --apply and --verify');
  const approvedPlanSha = readOption('approve-plan');
  const maxDocuments = Number(readOption('max-documents') ?? DEFAULT_MAX_DOCUMENTS);
  if (!Number.isSafeInteger(maxDocuments) || maxDocuments <= 0) {
    throw new Error('--max-documents must be a positive safe integer');
  }
  const backupDirectory = path.resolve(
    readOption('backup-dir') ?? path.join(process.cwd(), 'tmp', 'migration-backups'),
  );

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const db = client.db();
    if (verifyOnly) {
      const verification = await assertPostcondition(db);
      process.stdout.write(`${JSON.stringify({ mode: 'verify', ...verification }, null, 2)}\n`);
      return;
    }

    const plan = await inspect(db);
    validateLifetimeRemovalPlan(plan, maxDocuments);
    let backupPath;
    if (apply && plan.affectedDocuments > 0) {
      if (!approvedPlanSha) throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
      backupPath = await applyMigration(client, db, approvedPlanSha, maxDocuments, backupDirectory);
      await assertPostcondition(db);
    } else if (apply) {
      await assertPostcondition(db);
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          planSha: plan.planSha,
          affectedDocuments: plan.affectedDocuments,
          lifetimePlan: Boolean(plan.lifetimePlan),
          lifetimeSubscriptions: plan.subscriptions.length,
          lifetimeUserReferences: plan.users.length,
          completedNonAdminPurchases: plan.realCompletedPurchases.length,
          monthlyPlanNeedsUpdate:
            stableJson(plan.monthlyPlan) !== stableJson({ _id: MONTHLY_PLAN_ID, ...MONTHLY_PLAN }),
          ...(backupPath ? { backupPath } : {}),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
