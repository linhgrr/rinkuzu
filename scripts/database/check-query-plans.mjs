import { MongoClient, ObjectId } from 'mongodb';
import { withCleanProbeRows } from './query-plan-probe.mjs';
import { buildRecentAttemptActivityPipeline } from '../../src/repositories/pipelines/recent-attempt-activity.mjs';

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

const PUBLIC_PROFILE_QUIZ_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  author: 1,
  questions: { $literal: [] },
  questionCount: { $size: { $ifNull: ['$questions', []] } },
  isPrivate: 1,
  createdAt: 1,
  updatedAt: 1,
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
  const attempts = db.collection('attempts');
  const subscriptions = db.collection('subscriptions');
  const users = db.collection('users');
  const quizzes = db.collection('quizzes');
  const marker = { _ciQueryPlanProbe: true };

  await withCleanProbeRows([attempts, quizzes, subscriptions, users], marker, async () => {
    const dashboardOwnerId = new ObjectId();
    const dashboardPublicAuthorIds = Array.from({ length: 400 }, () => new ObjectId());
    const dashboardPublicQuizIds = Array.from({ length: 400 }, () => new ObjectId());
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
      _id: dashboardPublicQuizIds[index],
      author,
      slug: `ci-dashboard-public-${index}`,
      title: `Public quiz ${index}`,
      isPrivate: false,
      questions: [],
      createdAt: new Date(now.getTime() - index * 1_000),
      updatedAt: now,
    }));
    const attemptRows = dashboardPublicAuthorIds.map((user, index) => ({
      ...marker,
      ...(index % 2 === 0 ? { user } : { guestEmail: `ci-plan-guest-${index}@example.com` }),
      quiz: dashboardPublicQuizIds[index],
      score: index % 101,
      totalQuestions: 2,
      answers: [
        { kind: 'single', selectedIndex: index % 2 === 0 ? 0 : null },
        {
          kind: 'multiple',
          selectedIndexes: index % 3 === 0 ? [0] : [],
          selectedIndex: null,
        },
      ],
      takenAt: new Date(now.getTime() - index * 1_000),
    }));

    await Promise.all([
      attempts.insertMany(attemptRows),
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

    const publicProfileQuizPipeline = buildPublicProfileQuizPipeline(dashboardOwnerId, 4);
    const [publicProfileQuizExplain, publicProfileQuizRows] = await Promise.all([
      quizzes.aggregate(publicProfileQuizPipeline).explain('executionStats'),
      quizzes.aggregate(publicProfileQuizPipeline).toArray(),
    ]);
    const publicProfileQuizCursor = publicProfileQuizExplain.stages?.find(
      (stage) => stage.$cursor,
    )?.$cursor;
    const publicProfileQuizStats = publicProfileQuizCursor?.executionStats;
    if (!publicProfileQuizStats) {
      throw new Error('public-profile-quizzes did not return executionStats');
    }

    const publicProfileQuizStages = collectStageNames(publicProfileQuizExplain);
    const publicProfileQuizRow = {
      name: 'public-profile-quizzes',
      stages: [...publicProfileQuizStages].sort(),
      keysExamined: publicProfileQuizStats.totalKeysExamined,
      documentsExamined: publicProfileQuizStats.totalDocsExamined,
      returnedRows: publicProfileQuizStats.nReturned,
      projection: PUBLIC_PROFILE_QUIZ_PROJECTION,
    };
    if (!publicProfileQuizStages.has('IXSCAN')) {
      throw new Error('public-profile-quizzes did not use IXSCAN');
    }
    if (
      publicProfileQuizRow.returnedRows !== 4 ||
      publicProfileQuizRow.keysExamined > 4 ||
      publicProfileQuizRow.documentsExamined > 4
    ) {
      throw new Error(
        `public-profile-quizzes examined ${publicProfileQuizRow.keysExamined} keys/${publicProfileQuizRow.documentsExamined} documents and returned ${publicProfileQuizRow.returnedRows} rows; expected at most 4/4 for 4 rows`,
      );
    }
    if (
      publicProfileQuizRows.length !== 4 ||
      !publicProfileQuizRows.every(
        (row) =>
          String(row.author) === String(dashboardOwnerId) &&
          row.isPrivate === false &&
          row.questionCount === 0 &&
          Array.isArray(row.questions) &&
          row.questions.length === 0,
      )
    ) {
      throw new Error('public-profile-quizzes read model semantics changed');
    }
    evidence.push(publicProfileQuizRow);

    const recentAttemptPipeline = buildRecentAttemptActivityPipeline(5);
    const [recentAttemptExplain, recentAttemptRows] = await Promise.all([
      attempts.aggregate(recentAttemptPipeline).explain('executionStats'),
      attempts.aggregate(recentAttemptPipeline).toArray(),
    ]);
    const recentAttemptCursor = recentAttemptExplain.stages?.find(
      (stage) => stage.$cursor,
    )?.$cursor;
    const recentAttemptStats = recentAttemptCursor?.executionStats;
    const recentAttemptLookups =
      recentAttemptExplain.stages?.filter((stage) => stage.$lookup) ?? [];
    if (!recentAttemptStats) {
      throw new Error('admin-recent-attempts did not return executionStats');
    }

    const recentAttemptStages = collectStageNames(recentAttemptExplain);
    const recentAttemptRow = {
      name: 'admin-recent-attempts',
      stages: [...recentAttemptStages].sort(),
      keysExamined: recentAttemptStats.totalKeysExamined,
      documentsExamined: recentAttemptStats.totalDocsExamined,
      returnedRows: recentAttemptStats.nReturned,
      lookupDocumentsExamined: recentAttemptLookups.map(
        (lookup) => lookup.totalDocsExamined ?? null,
      ),
      lookupIndexesUsed: recentAttemptLookups.map((lookup) => lookup.indexesUsed ?? []),
      projection: recentAttemptPipeline.at(-1)?.$project,
    };
    if (!recentAttemptStages.has('IXSCAN')) {
      throw new Error('admin-recent-attempts did not use IXSCAN');
    }
    if (
      recentAttemptRow.returnedRows !== 5 ||
      recentAttemptRow.keysExamined > 5 ||
      recentAttemptRow.documentsExamined > 5
    ) {
      throw new Error(
        `admin-recent-attempts examined ${recentAttemptRow.keysExamined} keys/${recentAttemptRow.documentsExamined} documents and returned ${recentAttemptRow.returnedRows} rows; expected at most 5/5 for 5 rows`,
      );
    }
    const expectedLookupDocuments = [3, 5];
    for (const [index, lookup] of recentAttemptLookups.entries()) {
      if (
        lookup.totalDocsExamined !== expectedLookupDocuments[index] ||
        !lookup.indexesUsed?.includes('_id_')
      ) {
        throw new Error(
          `admin-recent-attempts lookup ${index} examined ${String(lookup.totalDocsExamined)} documents without the expected _id_ plan`,
        );
      }
    }
    if (recentAttemptLookups.length !== 2) {
      throw new Error(
        `admin-recent-attempts used ${recentAttemptLookups.length} lookups; expected users and quizzes`,
      );
    }
    if (
      JSON.stringify(recentAttemptRows.map((row) => row.answeredQuestions)) !==
        JSON.stringify([2, 0, 1, 1, 1]) ||
      !recentAttemptRows.every(
        (row) =>
          Boolean(row.userEmail) !== Boolean(row.guestEmail) && typeof row.quizTitle === 'string',
      )
    ) {
      throw new Error('admin-recent-attempts read model semantics changed');
    }
    evidence.push(recentAttemptRow);

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

function buildPublicProfileQuizPipeline(authorId, limit) {
  return [
    { $match: { author: authorId, isPrivate: false } },
    { $sort: { createdAt: -1 } },
    { $skip: 0 },
    { $limit: limit },
    { $project: PUBLIC_PROFILE_QUIZ_PROJECTION },
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
