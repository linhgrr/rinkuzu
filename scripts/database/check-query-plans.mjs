import { MongoClient, ObjectId } from 'mongodb';
import { withCleanProbeRows } from './query-plan-probe.mjs';
import { buildRecentAttemptActivityPipeline } from '../../src/repositories/pipelines/recent-attempt-activity.mjs';
import { buildDiscussionListPipeline } from '../../src/repositories/pipelines/discussion-list.mjs';
import { buildUserAttemptListPipeline } from '../../src/repositories/pipelines/attempt-read.mjs';
import { buildCompactQuizPipeline } from '../../src/repositories/pipelines/quiz-list.mjs';
import { assertCoveredExactCountPlan } from './query-plan-contracts.mjs';

const DASHBOARD_QUIZ_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  visibility: 1,
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
  visibility: 1,
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
  const users = db.collection('users');
  const quizzes = db.collection('quizzes');
  const discussions = db.collection('discussions');
  const marker = { _ciQueryPlanProbe: true };
  const probeCollections = [attempts, quizzes, users, discussions];

  await withCleanProbeRows(probeCollections, marker, async () => {
    const dashboardOwnerId = new ObjectId();
    const dashboardPublicAuthorIds = Array.from({ length: 400 }, () => new ObjectId());
    const dashboardPublicQuizIds = Array.from({ length: 400 }, () => new ObjectId());
    const discussionQuizId = new ObjectId();
    const discussionNoiseQuizId = new ObjectId();
    const historyUserId = new ObjectId();
    const userRows = Array.from({ length: 400 }, (_, index) => ({
      ...marker,
      email: `ci-plan-user-${index}@example.com`,
      // Enough active admins for the role+disable count probe (role_1_disable_1).
      role: index < 20 ? 'admin' : 'user',
      disable: index % 5 === 0 ? 1 : 0,
      createdAt: new Date(now.getTime() - index * 1_000),
      ...(index === 0 ? { emailVerificationTokenHash: 'ci-plan-email-verification-token' } : {}),
      ...(index === 1 ? { passwordResetTokenHash: 'ci-plan-password-reset-token' } : {}),
    }));
    const dashboardUserRows = [dashboardOwnerId, ...dashboardPublicAuthorIds].map(
      (userId, index) => ({
        ...marker,
        _id: userId,
        email: `ci-dashboard-author-${index}@example.com`,
        displayName: `ci-dashboard-author-${index}`,
      }),
    );
    const ownedQuizRows = Array.from({ length: 400 }, (_, index) => ({
      ...marker,
      author: dashboardOwnerId,
      slug: `ci-dashboard-owned-${index}`,
      title: `Owned quiz ${index}`,
      visibility: index % 2 === 0 ? 'personal' : 'public',
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
      visibility: 'public',
      questions: [],
      createdAt: new Date(now.getTime() - index * 1_000),
      updatedAt: now,
    }));
    const attemptRows = dashboardPublicAuthorIds.map((user, index) => ({
      ...marker,
      ...(index % 2 === 0 ? { user } : { guestEmail: `ci-plan-guest-${index}@example.com` }),
      quiz: dashboardPublicQuizIds[index],
      quizSnapshot: buildAttemptSnapshot(index, 2),
      score: index % 101,
      totalQuestions: 2,
      answers: [
        { kind: 'single', selectedIndex: index % 2 === 0 ? 0 : null },
        {
          kind: 'multiple',
          selectedIndexes: index % 3 === 0 ? [0] : [],
        },
      ],
      takenAt: new Date(now.getTime() - index * 1_000),
    }));
    const historyAttemptRows = dashboardPublicQuizIds.map((quiz, index) => ({
      ...marker,
      user: historyUserId,
      quiz,
      quizSnapshot: buildAttemptSnapshot(index, 1),
      score: index % 101,
      totalQuestions: 1,
      answers: [{ kind: 'single', selectedIndex: 0 }],
      takenAt: new Date(now.getTime() - 1_000_000 - index * 1_000),
    }));
    const historyNoiseAttemptRows = Array.from({ length: 1_600 }, (_, index) => ({
      ...marker,
      user: new ObjectId(),
      quiz: dashboardPublicQuizIds[index % dashboardPublicQuizIds.length],
      quizSnapshot: buildAttemptSnapshot(index % dashboardPublicQuizIds.length, 1),
      score: index % 101,
      totalQuestions: 1,
      answers: [{ kind: 'single', selectedIndex: 0 }],
      takenAt: new Date(now.getTime() - 2_000_000 - index * 1_000),
    }));
    const discussionRows = Array.from({ length: 8 }, (_, questionIndex) => ({
      ...marker,
      quiz: discussionQuizId,
      questionIndex,
      comments: [
        {
          _id: new ObjectId(),
          author: dashboardPublicAuthorIds[questionIndex],
          content: `Discussion ${questionIndex}`,
          isEdited: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }));
    const discussionNoiseRows = Array.from({ length: 400 }, (_, questionIndex) => ({
      ...marker,
      quiz: discussionNoiseQuizId,
      questionIndex,
      comments: [],
      createdAt: now,
      updatedAt: now,
    }));

    await Promise.all([
      attempts.insertMany([...attemptRows, ...historyAttemptRows, ...historyNoiseAttemptRows]),
      quizzes.insertMany([...ownedQuizRows, ...publicQuizRows]),
      users.insertMany([...userRows, ...dashboardUserRows]),
      discussions.insertMany([...discussionRows, ...discussionNoiseRows]),
    ]);

    const evidence = [];
    const indexedStringChecks = [
      {
        name: 'email-verification-token-lookup',
        collection: users,
        filter: {
          emailVerificationTokenHash: {
            $eq: 'ci-plan-email-verification-token',
            $type: 'string',
          },
        },
        expectedIndex: 'emailVerificationTokenHash_1',
      },
      {
        name: 'password-reset-token-lookup',
        collection: users,
        filter: {
          passwordResetTokenHash: { $eq: 'ci-plan-password-reset-token', $type: 'string' },
        },
        expectedIndex: 'passwordResetTokenHash_1',
      },
    ];

    for (const check of indexedStringChecks) {
      const explain = await check.collection.find(check.filter).limit(1).explain('executionStats');
      const stats = explain.executionStats;
      const stages = collectStageNames(stats.executionStages);
      const indexes = collectIndexNames(stats.executionStages);
      const row = {
        name: check.name,
        stages: [...stages].sort(),
        indexes: [...indexes].sort(),
        keysExamined: stats.totalKeysExamined,
        documentsExamined: stats.totalDocsExamined,
        returnedRows: stats.nReturned,
      };
      if (!stages.has('IXSCAN') || !indexes.has(check.expectedIndex)) {
        throw new Error(
          `${check.name} did not use ${check.expectedIndex}; stages=${row.stages.join(',')}; indexes=${row.indexes.join(',')}`,
        );
      }
      if (row.returnedRows !== 1 || row.keysExamined > 1 || row.documentsExamined > 1) {
        throw new Error(
          `${check.name} examined ${row.keysExamined} keys/${row.documentsExamined} documents and returned ${row.returnedRows} rows; expected at most 1/1 for one row`,
        );
      }
      evidence.push(row);
    }

    const recentUsersExplain = await users
      .find({}, { projection: { email: 1, role: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .explain('executionStats');
    const recentUsersStats = recentUsersExplain.executionStats;
    const recentUsersStages = collectStageNames(recentUsersStats.executionStages);
    const recentUsersIndexes = collectIndexNames(recentUsersStats.executionStages);
    const recentUsersRow = {
      name: 'admin-recent-users',
      stages: [...recentUsersStages].sort(),
      indexes: [...recentUsersIndexes].sort(),
      keysExamined: recentUsersStats.totalKeysExamined,
      documentsExamined: recentUsersStats.totalDocsExamined,
      returnedRows: recentUsersStats.nReturned,
    };
    if (
      !recentUsersStages.has('IXSCAN') ||
      recentUsersStages.has('SORT') ||
      !recentUsersIndexes.has('createdAt_-1')
    ) {
      throw new Error(
        `admin-recent-users did not use createdAt_-1 without a blocking sort; stages=${recentUsersRow.stages.join(',')}; indexes=${recentUsersRow.indexes.join(',')}`,
      );
    }
    if (
      recentUsersRow.returnedRows !== 5 ||
      recentUsersRow.keysExamined > 5 ||
      recentUsersRow.documentsExamined > 5
    ) {
      throw new Error(
        `admin-recent-users examined ${recentUsersRow.keysExamined} keys/${recentUsersRow.documentsExamined} documents and returned ${recentUsersRow.returnedRows} rows; expected at most 5/5 for five rows`,
      );
    }
    evidence.push(recentUsersRow);

    // Admin status list: filter by disable, sort by createdAt using compound index.
    const adminStatusUsersExplain = await users
      .find({ disable: 0 }, { projection: { email: 1, role: 1, createdAt: 1, disable: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .explain('executionStats');
    const adminStatusUsersStats = adminStatusUsersExplain.executionStats;
    const adminStatusUsersStages = collectStageNames(adminStatusUsersStats.executionStages);
    const adminStatusUsersIndexes = collectIndexNames(adminStatusUsersStats.executionStages);
    const adminStatusUsersRow = {
      name: 'admin-status-active-users',
      stages: [...adminStatusUsersStages].sort(),
      indexes: [...adminStatusUsersIndexes].sort(),
      keysExamined: adminStatusUsersStats.totalKeysExamined,
      documentsExamined: adminStatusUsersStats.totalDocsExamined,
      returnedRows: adminStatusUsersStats.nReturned,
    };
    if (
      !adminStatusUsersStages.has('IXSCAN') ||
      adminStatusUsersStages.has('SORT') ||
      !adminStatusUsersIndexes.has('disable_1_createdAt_-1')
    ) {
      throw new Error(
        `admin-status-active-users did not use disable_1_createdAt_-1 without a blocking sort; stages=${adminStatusUsersRow.stages.join(',')}; indexes=${adminStatusUsersRow.indexes.join(',')}`,
      );
    }
    if (
      adminStatusUsersRow.returnedRows !== 5 ||
      adminStatusUsersRow.keysExamined > 5 ||
      adminStatusUsersRow.documentsExamined > 5
    ) {
      throw new Error(
        `admin-status-active-users examined ${adminStatusUsersRow.keysExamined} keys/${adminStatusUsersRow.documentsExamined} documents and returned ${adminStatusUsersRow.returnedRows} rows; expected at most 5/5 for five rows`,
      );
    }
    evidence.push(adminStatusUsersRow);

    // Active-admin invariant count: exact role+disable match must use role_1_disable_1.
    const activeAdminCountExplain = await users
      .find({ role: 'admin', disable: 0 }, { projection: { _id: 1 } })
      .explain('executionStats');
    const activeAdminCountStats = activeAdminCountExplain.executionStats;
    const activeAdminCountStages = collectStageNames(activeAdminCountStats.executionStages);
    const activeAdminCountIndexes = collectIndexNames(activeAdminCountStats.executionStages);
    const activeAdminCountRow = {
      name: 'active-admin-count',
      stages: [...activeAdminCountStages].sort(),
      indexes: [...activeAdminCountIndexes].sort(),
      keysExamined: activeAdminCountStats.totalKeysExamined,
      documentsExamined: activeAdminCountStats.totalDocsExamined,
      returnedRows: activeAdminCountStats.nReturned,
    };
    if (!activeAdminCountStages.has('IXSCAN') || !activeAdminCountIndexes.has('role_1_disable_1')) {
      throw new Error(
        `active-admin-count did not use role_1_disable_1; stages=${activeAdminCountRow.stages.join(',')}; indexes=${activeAdminCountRow.indexes.join(',')}`,
      );
    }
    if (activeAdminCountRow.documentsExamined > activeAdminCountRow.returnedRows) {
      throw new Error(
        `active-admin-count examined ${activeAdminCountRow.documentsExamined} documents for ${activeAdminCountRow.returnedRows} rows; expected covered index scan`,
      );
    }
    evidence.push(activeAdminCountRow);

    const [allQuizCountExplain, allQuizCountRows] = await Promise.all([
      quizzes.aggregate([{ $count: 'totalItems' }], { hint: '_id_' }).explain('executionStats'),
      quizzes.aggregate([{ $count: 'totalItems' }], { hint: '_id_' }).toArray(),
    ]);
    const allQuizCountStats =
      allQuizCountExplain.executionStats ??
      allQuizCountExplain.stages?.find((stage) => stage.$cursor)?.$cursor?.executionStats;
    if (!allQuizCountStats) {
      throw new Error('all-quiz-count did not return executionStats');
    }
    const allQuizCountStages = collectStageNames(allQuizCountStats.executionStages);
    const allQuizCountIndexes = collectIndexNames(allQuizCountStats.executionStages);
    const allQuizCountRow = {
      name: 'all-quiz-count',
      stages: [...allQuizCountStages].sort(),
      indexes: [...allQuizCountIndexes].sort(),
      keysExamined: allQuizCountStats.totalKeysExamined,
      documentsExamined: allQuizCountStats.totalDocsExamined,
      returnedRows: allQuizCountStats.nReturned,
    };
    const allQuizTotal = allQuizCountRows[0]?.totalItems;
    if (allQuizTotal !== 800) {
      throw new Error(`all-quiz-count returned ${String(allQuizTotal)}; expected 800`);
    }
    assertCoveredExactCountPlan(allQuizCountRow, {
      totalItems: allQuizTotal,
      expectedIndex: '_id_',
    });
    evidence.push(allQuizCountRow);

    const publicQuizFilter = { visibility: 'public' };
    const publicQuizListPipeline = buildCompactQuizPipeline(publicQuizFilter, {
      limit: 4,
      populateAuthor: true,
      skip: 0,
      sort: { createdAt: -1 },
    });
    const publicQuizCountPipeline = [{ $match: publicQuizFilter }, { $count: 'totalItems' }];
    const [publicQuizListExplain, publicQuizCountExplain, publicQuizListRows, publicQuizCountRows] =
      await Promise.all([
        quizzes.aggregate(publicQuizListPipeline).explain('executionStats'),
        quizzes.aggregate(publicQuizCountPipeline).explain('executionStats'),
        quizzes.aggregate(publicQuizListPipeline).toArray(),
        quizzes.aggregate(publicQuizCountPipeline).toArray(),
      ]);
    const publicQuizListCursor = publicQuizListExplain.stages?.find(
      (stage) => stage.$cursor,
    )?.$cursor;
    const publicQuizListStats = publicQuizListCursor?.executionStats;
    const publicQuizCountStats =
      publicQuizCountExplain.executionStats ??
      publicQuizCountExplain.stages?.find((stage) => stage.$cursor)?.$cursor?.executionStats;
    const publicQuizListLookup = publicQuizListExplain.stages?.find((stage) => stage.$lookup);
    if (!publicQuizListStats || !publicQuizCountStats) {
      throw new Error('public-quiz-list did not return item and count executionStats');
    }

    const publicQuizListStages = collectStageNames(publicQuizListStats.executionStages);
    const publicQuizListIndexes = collectIndexNames(publicQuizListStats.executionStages);
    const publicQuizCountStages = collectStageNames(publicQuizCountStats.executionStages);
    const publicQuizCountIndexes = collectIndexNames(publicQuizCountStats.executionStages);
    const publicQuizListRow = {
      name: 'public-quiz-list',
      roundTrips: 2,
      stages: [...publicQuizListStages].sort(),
      indexes: [...publicQuizListIndexes].sort(),
      keysExamined: publicQuizListStats.totalKeysExamined,
      documentsExamined: publicQuizListStats.totalDocsExamined,
      returnedRows: publicQuizListStats.nReturned,
      countStages: [...publicQuizCountStages].sort(),
      countIndexes: [...publicQuizCountIndexes].sort(),
      countKeysExamined: publicQuizCountStats.totalKeysExamined,
      countDocumentsExamined: publicQuizCountStats.totalDocsExamined,
      countReturnedRows: publicQuizCountStats.nReturned,
      lookupDocumentsExamined: publicQuizListLookup?.totalDocsExamined ?? null,
      lookupIndexesUsed: publicQuizListLookup?.indexesUsed ?? [],
    };
    if (
      !publicQuizListStages.has('IXSCAN') ||
      publicQuizListStages.has('SORT') ||
      !publicQuizListIndexes.has('visibility_1_createdAt_-1')
    ) {
      throw new Error(
        `public-quiz-list did not use visibility_1_createdAt_-1 without a blocking sort; stages=${publicQuizListRow.stages.join(',')}; indexes=${publicQuizListRow.indexes.join(',')}`,
      );
    }
    if (
      publicQuizListRow.returnedRows !== 4 ||
      publicQuizListRow.keysExamined > 4 ||
      publicQuizListRow.documentsExamined > 4
    ) {
      throw new Error(
        `public-quiz-list examined ${publicQuizListRow.keysExamined} keys/${publicQuizListRow.documentsExamined} documents and returned ${publicQuizListRow.returnedRows} rows; expected at most 4/4`,
      );
    }
    assertCoveredExactCountPlan(
      {
        name: 'public-quiz-list-count',
        stages: publicQuizListRow.countStages,
        indexes: publicQuizListRow.countIndexes,
        keysExamined: publicQuizListRow.countKeysExamined,
        documentsExamined: publicQuizListRow.countDocumentsExamined,
        returnedRows: publicQuizListRow.countReturnedRows,
      },
      { totalItems: 600, expectedIndex: 'visibility_1_createdAt_-1' },
    );
    if (
      publicQuizListRow.lookupDocumentsExamined !== 4 ||
      !publicQuizListRow.lookupIndexesUsed.includes('_id_')
    ) {
      throw new Error(
        `public-quiz-list author lookup examined ${String(publicQuizListRow.lookupDocumentsExamined)} documents without the users _id_ index`,
      );
    }
    if (
      publicQuizCountRows[0]?.totalItems !== 600 ||
      publicQuizListRows.length !== 4 ||
      !publicQuizListRows.every(
        (item) =>
          item.visibility === 'public' &&
          item.questionCount === 0 &&
          Array.isArray(item.questions) &&
          item.questions.length === 0 &&
          !Object.hasOwn(item, '_ciQueryPlanProbe'),
      )
    ) {
      throw new Error('public-quiz-list read model semantics changed');
    }
    evidence.push(publicQuizListRow);

    const dashboardChecks = [
      {
        name: 'dashboard-recent-owned-quizzes',
        match: { author: dashboardOwnerId },
        limit: 4,
        maxKeysExamined: 4,
        maxDocumentsExamined: 4,
        expectedIndex: 'author_1_createdAt_-1',
      },
      {
        name: 'dashboard-recent-public-quizzes',
        match: { visibility: 'public', author: { $ne: dashboardOwnerId } },
        limit: 4,
        // The fixture deliberately interleaves recent public quizzes from the owner.
        // `$ne` is a range predicate, so the visibility/sort index must scan and reject them.
        maxKeysExamined: 8,
        maxDocumentsExamined: 8,
        expectedIndex: 'visibility_1_createdAt_-1',
      },
      {
        name: 'admin-recent-quizzes',
        match: {},
        limit: 5,
        maxKeysExamined: 5,
        maxDocumentsExamined: 5,
        expectedIndex: 'createdAt_-1',
      },
    ];

    for (const check of dashboardChecks) {
      const explain = await quizzes
        .aggregate(buildDashboardRecentQuizPipeline(check.match, check.limit))
        .explain('executionStats');
      const cursor = explain.stages?.find((stage) => stage.$cursor)?.$cursor;
      const stats = cursor?.executionStats;
      const lookup = explain.stages?.find((stage) => stage.$lookup);
      if (!stats) throw new Error(`${check.name} did not return executionStats`);

      const stages = collectStageNames(stats.executionStages);
      const indexes = collectIndexNames(stats.executionStages);
      const row = {
        name: check.name,
        stages: [...stages].sort(),
        indexes: [...indexes].sort(),
        keysExamined: stats.totalKeysExamined,
        documentsExamined: stats.totalDocsExamined,
        returnedRows: stats.nReturned,
        lookupDocumentsExamined: lookup?.totalDocsExamined ?? null,
        lookupIndexesUsed: lookup?.indexesUsed ?? [],
        projection: DASHBOARD_QUIZ_PROJECTION,
      };
      if (!stages.has('IXSCAN') || stages.has('SORT') || !indexes.has(check.expectedIndex)) {
        throw new Error(
          `${check.name} did not use ${check.expectedIndex} without a blocking sort; stages=${row.stages.join(',')}; indexes=${row.indexes.join(',')}`,
        );
      }
      if (row.returnedRows !== check.limit) {
        throw new Error(`${check.name} returned ${row.returnedRows} rows; expected ${check.limit}`);
      }
      if (
        row.keysExamined > check.maxKeysExamined ||
        row.documentsExamined > check.maxDocumentsExamined
      ) {
        throw new Error(
          `${check.name} examined ${row.keysExamined}/${check.maxKeysExamined} keys and ${row.documentsExamined}/${check.maxDocumentsExamined} documents for ${check.limit} rows`,
        );
      }
      if (row.lookupDocumentsExamined !== check.limit || !row.lookupIndexesUsed.includes('_id_')) {
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

    const publicProfileQuizStages = collectStageNames(publicProfileQuizStats.executionStages);
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
          row.visibility === 'public' &&
          row.questionCount === 0 &&
          Array.isArray(row.questions) &&
          row.questions.length === 0,
      )
    ) {
      throw new Error('public-profile-quizzes read model semantics changed');
    }
    evidence.push(publicProfileQuizRow);

    const attemptHistoryPipeline = buildUserAttemptListPipeline(historyUserId, 0, 4);
    const [attemptHistoryExplain, attemptHistoryResults] = await Promise.all([
      attempts.aggregate(attemptHistoryPipeline).explain('executionStats'),
      attempts.aggregate(attemptHistoryPipeline).toArray(),
    ]);
    const attemptHistoryCursor = attemptHistoryExplain.stages?.find(
      (stage) => stage.$cursor,
    )?.$cursor;
    const attemptHistoryStats = attemptHistoryCursor?.executionStats;
    const attemptHistoryLookups = findOperatorStages(attemptHistoryExplain.stages, '$lookup');
    if (!attemptHistoryStats) {
      throw new Error('user-attempt-history did not return executionStats');
    }

    const attemptHistoryStages = collectStageNames(attemptHistoryStats.executionStages);
    const attemptHistoryResult = attemptHistoryResults[0];
    const attemptHistoryRow = {
      name: 'user-attempt-history',
      stages: [...attemptHistoryStages].sort(),
      keysExamined: attemptHistoryStats.totalKeysExamined,
      documentsExamined: attemptHistoryStats.totalDocsExamined,
      returnedRows: attemptHistoryStats.nReturned,
      lookupDocumentsExamined: attemptHistoryLookups.reduce(
        (total, lookup) => total + (lookup.totalDocsExamined ?? 0),
        0,
      ),
      lookupIndexesUsed: attemptHistoryLookups.flatMap((lookup) => lookup.indexesUsed ?? []),
      projection: getFacetProjection(attemptHistoryPipeline, 'items'),
    };
    if (!attemptHistoryStages.has('IXSCAN') || attemptHistoryStages.has('SORT')) {
      throw new Error(
        `user-attempt-history did not use its user/takenAt index; stages=${attemptHistoryRow.stages.join(',')}`,
      );
    }
    if (
      attemptHistoryRow.returnedRows !== 400 ||
      attemptHistoryRow.keysExamined > 400 ||
      attemptHistoryRow.documentsExamined > 400
    ) {
      throw new Error(
        `user-attempt-history examined ${attemptHistoryRow.keysExamined} keys/${attemptHistoryRow.documentsExamined} documents and returned ${attemptHistoryRow.returnedRows} rows to the facet; expected at most 400/400`,
      );
    }
    if (attemptHistoryLookups.length !== 0) {
      throw new Error(
        `user-attempt-history performed ${attemptHistoryLookups.length} unexpected lookups`,
      );
    }
    if (
      attemptHistoryResult?.meta?.[0]?.totalItems !== 400 ||
      attemptHistoryResult.items?.length !== 4 ||
      !attemptHistoryResult.items.every(
        (item) =>
          Array.isArray(item.answers) &&
          item.answers.length === 0 &&
          !Object.hasOwn(item.quiz, 'questions') &&
          !Object.hasOwn(item.quiz, '_ciQueryPlanProbe'),
      )
    ) {
      throw new Error('user-attempt-history read model semantics changed');
    }
    evidence.push(attemptHistoryRow);

    const discussionPipeline = buildDiscussionListPipeline(discussionQuizId);
    const [discussionExplain, discussionResults] = await Promise.all([
      discussions.aggregate(discussionPipeline).explain('executionStats'),
      discussions.aggregate(discussionPipeline).toArray(),
    ]);
    const discussionCursor = discussionExplain.stages?.find((stage) => stage.$cursor)?.$cursor;
    const discussionStats = discussionCursor?.executionStats;
    const discussionLookup = discussionExplain.stages?.find((stage) => stage.$lookup);
    if (!discussionStats) {
      throw new Error('quiz-discussions did not return executionStats');
    }

    const discussionStages = collectStageNames(discussionStats.executionStages);
    const discussionRow = {
      name: 'quiz-discussions',
      stages: [...discussionStages].sort(),
      keysExamined: discussionStats.totalKeysExamined,
      documentsExamined: discussionStats.totalDocsExamined,
      returnedRows: discussionStats.nReturned,
      lookupDocumentsExamined: discussionLookup?.totalDocsExamined ?? null,
      lookupIndexesUsed: discussionLookup?.indexesUsed ?? [],
      projection: getFinalProjection(discussionPipeline),
    };
    if (!discussionStages.has('IXSCAN') || discussionStages.has('SORT')) {
      throw new Error('quiz-discussions did not use its quiz/question index for ordered reads');
    }
    if (
      discussionRow.returnedRows !== 8 ||
      discussionRow.keysExamined > 8 ||
      discussionRow.documentsExamined > 8
    ) {
      throw new Error(
        `quiz-discussions examined ${discussionRow.keysExamined} keys/${discussionRow.documentsExamined} documents and returned ${discussionRow.returnedRows} rows; expected at most 8/8 for 8 rows`,
      );
    }
    if (
      discussionRow.lookupDocumentsExamined !== 8 ||
      !discussionRow.lookupIndexesUsed.includes('_id_')
    ) {
      throw new Error(
        `quiz-discussions author lookup examined ${String(discussionRow.lookupDocumentsExamined)} documents without the users _id_ index`,
      );
    }
    if (
      discussionResults.length !== 8 ||
      !discussionResults.every(
        (row, questionIndex) =>
          row.questionIndex === questionIndex &&
          row.comments.length === 1 &&
          row.comments[0].author.displayName === `ci-dashboard-author-${questionIndex + 1}` &&
          !Object.hasOwn(row.comments[0].author, 'email') &&
          !Object.hasOwn(row, '_ciQueryPlanProbe') &&
          !Object.hasOwn(row.comments[0].author, '_ciQueryPlanProbe'),
      )
    ) {
      throw new Error('quiz-discussions read model semantics changed');
    }
    evidence.push(discussionRow);

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

    const recentAttemptStages = collectStageNames(recentAttemptStats.executionStages);
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
      projection: getFinalProjection(recentAttemptPipeline),
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
    const expectedLookupDocuments = [3];
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
    if (recentAttemptLookups.length !== 1) {
      throw new Error(
        `admin-recent-attempts used ${recentAttemptLookups.length} lookups; expected users only`,
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

function buildAttemptSnapshot(index, questionCount) {
  return {
    integrity: 'complete',
    title: `Public quiz ${index}`,
    slug: `ci-dashboard-public-${index}`,
    questions: Array.from({ length: questionCount }, (_, questionIndex) => ({
      _id: new ObjectId(),
      question: `Question ${questionIndex}`,
      options: ['A', 'B'],
      type: questionIndex === 0 ? 'single' : 'multiple',
      ...(questionIndex === 0 ? { correctIndex: 0 } : { correctIndexes: [0] }),
    })),
  };
}

function buildDashboardRecentQuizPipeline(match, limit) {
  return [
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $skip: 0 },
    { $limit: limit },
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
    { $match: { author: authorId, visibility: 'public' } },
    { $sort: { createdAt: -1 } },
    { $skip: 0 },
    { $limit: limit },
    { $project: PUBLIC_PROFILE_QUIZ_PROJECTION },
  ];
}

/**
 * @param {import('mongoose').PipelineStage[]} pipeline
 * @returns {import('mongodb').Document | undefined}
 */
function getFinalProjection(pipeline) {
  const finalStage = pipeline.at(-1);
  return finalStage && '$project' in finalStage ? finalStage.$project : undefined;
}

/**
 * @param {import('mongoose').PipelineStage[]} pipeline
 * @param {string} facetName
 * @returns {import('mongodb').Document | undefined}
 */
function getFacetProjection(pipeline, facetName) {
  const finalStage = pipeline.at(-1);
  if (!finalStage || !('$facet' in finalStage)) return undefined;
  return getFinalProjection(finalStage.$facet[facetName] ?? []);
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

function collectIndexNames(stage, names = new Set()) {
  if (!stage || typeof stage !== 'object') return names;
  if (typeof stage.indexName === 'string') names.add(stage.indexName);
  for (const value of Object.values(stage)) {
    if (Array.isArray(value)) {
      for (const entry of value) collectIndexNames(entry, names);
    } else if (value && typeof value === 'object') {
      collectIndexNames(value, names);
    }
  }
  return names;
}

function findOperatorStages(stage, operator, matches = []) {
  if (!stage || typeof stage !== 'object') return matches;
  if (!Array.isArray(stage) && Object.hasOwn(stage, operator)) {
    matches.push(stage);
  }
  for (const value of Object.values(stage)) {
    if (value && typeof value === 'object') {
      findOperatorStages(value, operator, matches);
    }
  }
  return matches;
}
