import { MongoClient, ObjectId } from 'mongodb';
import { withCleanProbeRows } from './query-plan-probe.mjs';

const DASHBOARD_QUIZ_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  isPrivate: 1,
  author: {
    _id: { $ifNull: ['$authorDoc._id', '$author'] },
    email: '$authorDoc.email',
    name: '$authorDoc.name',
    displayName: '$authorDoc.displayName',
    avatar: '$authorDoc.avatar',
  },
  createdAt: 1,
  updatedAt: 1,
  folder: 1,
  questionCount: { $size: { $ifNull: ['$questions', []] } },
  questions: { $literal: [] },
};

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
  const quizzes = db.collection('quizzes');
  const marker = { _ciQueryPlanProbe: true };

  await withCleanProbeRows([quizzes, subscriptions, users], marker, async () => {
    const dashboardOwnerId = new ObjectId();
    const dashboardPublicAuthorIds = Array.from({ length: 400 }, () => new ObjectId());
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
    const dashboardUserRows = [dashboardOwnerId, ...dashboardPublicAuthorIds].map(
      (userId, index) => ({
        ...marker,
        _id: userId,
        email: `ci-dashboard-author-${index}@example.com`,
      }),
    );
    const ownedQuizRows = Array.from({ length: 400 }, (_, index) => ({
      ...marker,
      author: dashboardOwnerId,
      slug: `ci-dashboard-owned-${index}`,
      title: `Owned quiz ${index}`,
      isPrivate: index % 2 === 0,
      questions: [],
      createdAt: new Date(now.getTime() - index * 1_000),
      updatedAt: now,
    }));
    const publicQuizRows = dashboardPublicAuthorIds.map((author, index) => ({
      ...marker,
      author,
      slug: `ci-dashboard-public-${index}`,
      title: `Public quiz ${index}`,
      isPrivate: false,
      questions: [],
      createdAt: new Date(now.getTime() - index * 1_000),
      updatedAt: now,
    }));

    await Promise.all([
      quizzes.insertMany([...ownedQuizRows, ...publicQuizRows]),
      subscriptions.insertMany(subscriptionRows),
      users.insertMany([...userRows, ...dashboardUserRows]),
    ]);

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

    const dashboardChecks = [
      {
        name: 'dashboard-recent-owned-quizzes',
        match: { author: dashboardOwnerId },
        maxKeysExamined: 4,
        maxDocumentsExamined: 4,
      },
      {
        name: 'dashboard-recent-public-quizzes',
        match: { isPrivate: false, author: { $ne: dashboardOwnerId } },
        // The fixture deliberately interleaves recent public quizzes from the owner.
        // `$ne` is a range predicate, so the visibility/sort index must scan and reject them.
        maxKeysExamined: 8,
        maxDocumentsExamined: 8,
      },
    ];

    for (const check of dashboardChecks) {
      const explain = await quizzes
        .aggregate(buildDashboardRecentQuizPipeline(check.match))
        .explain('executionStats');
      const cursor = explain.stages?.find((stage) => stage.$cursor)?.$cursor;
      const stats = cursor?.executionStats;
      const lookup = explain.stages?.find((stage) => stage.$lookup);
      if (!stats) throw new Error(`${check.name} did not return executionStats`);

      const stages = collectStageNames(explain);
      const row = {
        name: check.name,
        stages: [...stages].sort(),
        keysExamined: stats.totalKeysExamined,
        documentsExamined: stats.totalDocsExamined,
        returnedRows: stats.nReturned,
        lookupDocumentsExamined: lookup?.totalDocsExamined ?? null,
        lookupIndexesUsed: lookup?.indexesUsed ?? [],
        projection: DASHBOARD_QUIZ_PROJECTION,
      };
      if (!stages.has('IXSCAN')) throw new Error(`${check.name} did not use IXSCAN`);
      if (row.returnedRows !== 4) {
        throw new Error(`${check.name} returned ${row.returnedRows} rows; expected 4`);
      }
      if (
        row.keysExamined > check.maxKeysExamined ||
        row.documentsExamined > check.maxDocumentsExamined
      ) {
        throw new Error(
          `${check.name} examined ${row.keysExamined}/${check.maxKeysExamined} keys and ${row.documentsExamined}/${check.maxDocumentsExamined} documents for four rows`,
        );
      }
      if (row.lookupDocumentsExamined !== 4 || !row.lookupIndexesUsed.includes('_id_')) {
        throw new Error(
          `${check.name} author lookup examined ${String(row.lookupDocumentsExamined)} documents without the users _id_ index`,
        );
      }
      evidence.push(row);
    }

    process.stdout.write(`${JSON.stringify({ databaseName, evidence }, null, 2)}\n`);
  });
} finally {
  await client.close();
}

function buildDashboardRecentQuizPipeline(match) {
  return [
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $skip: 0 },
    { $limit: 4 },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorDoc',
      },
    },
    { $unwind: { path: '$authorDoc', preserveNullAndEmptyArrays: true } },
    { $project: DASHBOARD_QUIZ_PROJECTION },
  ];
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
