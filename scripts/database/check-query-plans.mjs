import { MongoClient, ObjectId } from 'mongodb';
import { withCleanProbeRows } from './query-plan-probe.mjs';

const uri = process.env.MONGODB_URI;
if (process.env.CI !== 'true') {
  throw new Error('Database query-plan probes are restricted to CI=true');
}
if (!uri) throw new Error('MONGODB_URI is required');

const parsedUri = new URL(uri);
const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\//, ''));
if (!['127.0.0.1', 'localhost'].includes(parsedUri.hostname) || databaseName !== 'rinkuzu_ci') {
  throw new Error('Query-plan probes are allowed only for localhost/rinkuzu_ci');
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
await client.connect();

try {
  const db = client.db();
  const now = new Date('2026-07-15T00:00:00.000Z');
  const subscriptions = db.collection('subscriptions');
  const users = db.collection('users');
  const marker = { _ciQueryPlanProbe: true };

  await withCleanProbeRows([subscriptions, users], marker, async () => {
    const subscriptionRows = Array.from({ length: 400 }, (_, index) => ({
      ...marker,
      user: new ObjectId(),
      status: 'completed',
      isActive: true,
      endDate:
        index === 0 ? new Date('2026-07-14T00:00:00.000Z') : new Date('2026-08-01T00:00:00.000Z'),
      payosOrderId: `ci-plan-subscription-${index}`,
    }));
    const userRows = Array.from({ length: 400 }, (_, index) => ({
      ...marker,
      email: `ci-plan-user-${index}@example.com`,
      subscription: {
        isActive: true,
        endDate:
          index === 0 ? new Date('2026-07-14T00:00:00.000Z') : new Date('2026-08-01T00:00:00.000Z'),
      },
    }));

    await Promise.all([subscriptions.insertMany(subscriptionRows), users.insertMany(userRows)]);

    const checks = [
      {
        name: 'subscriptions-expiration-scan',
        collection: subscriptions,
        filter: { status: 'completed', isActive: true, endDate: { $exists: true, $lte: now } },
        projection: { _id: 1, user: 1 },
        hint: { status: 1, isActive: 1, endDate: 1 },
      },
      {
        name: 'users-expiration-scan',
        collection: users,
        filter: {
          'subscription.isActive': true,
          'subscription.endDate': { $exists: true, $lte: now },
        },
        projection: { _id: 1 },
        hint: { 'subscription.isActive': 1, 'subscription.endDate': 1 },
      },
    ];

    const evidence = [];
    for (const check of checks) {
      const explain = await check.collection
        .find(check.filter, { projection: check.projection })
        .hint(check.hint)
        .explain('executionStats');
      const stats = explain.executionStats;
      const stages = collectStageNames(stats.executionStages);
      const row = {
        name: check.name,
        stages: [...stages].sort(),
        keysExamined: stats.totalKeysExamined,
        documentsExamined: stats.totalDocsExamined,
        returnedRows: stats.nReturned,
        projection: check.projection,
      };
      if (!stages.has('IXSCAN')) throw new Error(`${check.name} did not use IXSCAN`);
      if (row.returnedRows !== 1) {
        throw new Error(`${check.name} returned ${row.returnedRows} rows; expected 1`);
      }
      if (row.keysExamined > 2 || row.documentsExamined > 2) {
        throw new Error(
          `${check.name} examined ${row.keysExamined} keys/${row.documentsExamined} documents for one row`,
        );
      }
      evidence.push(row);
    }

    process.stdout.write(`${JSON.stringify({ databaseName, evidence }, null, 2)}\n`);
  });
} finally {
  await client.close();
}

function collectStageNames(stage, names = new Set()) {
  if (!stage || typeof stage !== 'object') return names;
  if (typeof stage.stage === 'string') names.add(stage.stage);
  for (const value of Object.values(stage)) {
    if (Array.isArray(value)) {
      for (const entry of value) collectStageNames(entry, names);
    } else if (value && typeof value === 'object') {
      collectStageNames(value, names);
    }
  }
  return names;
}
