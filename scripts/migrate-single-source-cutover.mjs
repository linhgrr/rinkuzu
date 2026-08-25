import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';

const { loadEnvConfig } = nextEnv;
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const CONFIRM_RETIRE = process.argv.includes('--confirm-retire-legacy');
const CONFIRM_DISCARD_ENTITLEMENT_MISMATCH = process.argv.includes(
  '--confirm-discard-entitlement-mismatch',
);
const CONFIRM_DELETE_LEGACY_COLLECTIONS = process.argv.includes(
  '--confirm-delete-legacy-collections',
);
const ARCHIVES = {
  subscriptions: '_archive_subscriptions_single_source_cutover',
  premiumreviewjobs: '_archive_premiumreviewjobs_single_source_cutover',
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function questionSnapshot(question) {
  return {
    text: question.question,
    options: question.options,
    type: question.type,
    ...(question.correctIndex === undefined ? {} : { correctIndex: question.correctIndex }),
    ...(question.correctIndexes === undefined ? {} : { correctIndexes: question.correctIndexes }),
    ...(question.questionImage === undefined ? {} : { questionImage: question.questionImage }),
    ...(question.optionImages === undefined ? {} : { optionImages: question.optionImages }),
  };
}

async function buildPlan(db) {
  const now = new Date();
  const [folderRows, bookmarkRows, legacyActiveUsers, legacyActiveSubscriptions] =
    await Promise.all([
      db
        .collection('quizzes')
        .find({ folder: { $type: 'objectId' } }, { projection: { author: 1, folder: 1 } })
        .sort({ _id: 1 })
        .toArray(),
      db
        .collection('questionprogresses')
        .find(
          { isBookmarked: true },
          { projection: { userId: 1, quizSlug: 1, questionId: 1, createdAt: 1, updatedAt: 1 } },
        )
        .sort({ _id: 1 })
        .toArray(),
      db
        .collection('users')
        .find(
          { 'subscription.isActive': true, 'subscription.endDate': { $gt: now } },
          { projection: { subscription: 1 } },
        )
        .toArray(),
      db
        .collection('subscriptions')
        .find(
          { status: 'completed', isActive: true, endDate: { $gt: now } },
          { projection: { user: 1, planId: 1, planName: 1, startDate: 1, endDate: 1 } },
        )
        .toArray(),
    ]);

  const folderTargets = [];
  for (const quiz of folderRows) {
    const folder = await db
      .collection('folders')
      .findOne({ _id: quiz.folder }, { projection: { owner: 1 } });
    if (!folder || String(folder.owner) !== String(quiz.author)) {
      throw new Error(`Quiz ${quiz._id} references a folder not owned by its author`);
    }
    folderTargets.push({ owner: quiz.author, quiz: quiz._id, folder: quiz.folder });
  }

  const bookmarkTargets = [];
  for (const progress of bookmarkRows) {
    const quiz = await db.collection('quizzes').findOne({ slug: progress.quizSlug });
    if (!quiz)
      throw new Error(
        `Bookmarked progress ${progress._id} references missing quiz ${progress.quizSlug}`,
      );
    const questionIndex = quiz.questions.findIndex(
      (question) => String(question._id) === String(progress.questionId),
    );
    if (questionIndex < 0)
      throw new Error(`Bookmarked progress ${progress._id} references a missing question`);
    const userObjectId = ObjectId.isValid(progress.userId) ? new ObjectId(progress.userId) : null;
    const user = userObjectId
      ? await db.collection('users').findOne({ _id: userObjectId }, { projection: { email: 1 } })
      : null;
    if (!user?.email)
      throw new Error(`Bookmarked progress ${progress._id} has no canonical user email`);
    bookmarkTargets.push({
      userId: String(progress.userId),
      userEmail: user.email,
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        ...(quiz.description === undefined ? {} : { description: quiz.description }),
      },
      question: questionSnapshot(quiz.questions[questionIndex]),
      questionIndex,
      createdAt: progress.createdAt ?? new Date(),
      updatedAt: progress.updatedAt ?? progress.createdAt ?? new Date(),
    });
  }

  const legacyActiveUserIds = new Set([
    ...legacyActiveUsers.map((row) => String(row._id)),
    ...legacyActiveSubscriptions.map((row) => String(row.user)),
  ]);
  const legacyActiveObjectIds = [...legacyActiveUserIds]
    .filter(ObjectId.isValid)
    .map((id) => new ObjectId(id));
  const [entitlementAccounts, entitlementGrants] = await Promise.all([
    db
      .collection('entitlementaccounts')
      .find(
        { user: { $in: legacyActiveObjectIds } },
        {
          projection: {
            user: 1,
            planId: 1,
            planName: 1,
            currentStartAt: 1,
            currentEndAt: 1,
            perpetual: 1,
          },
        },
      )
      .toArray(),
    db
      .collection('entitlementgrants')
      .find({ user: { $in: legacyActiveObjectIds } }, { projection: { user: 1 } })
      .toArray(),
  ]);
  const accountsByUser = new Map(entitlementAccounts.map((row) => [String(row.user), row]));
  const grantUsers = new Set(entitlementGrants.map((row) => String(row.user)));
  const legacyProjectionByUser = new Map();
  for (const row of legacyActiveSubscriptions) {
    const userId = String(row.user);
    const existing = legacyProjectionByUser.get(userId);
    if (!existing || row.endDate > existing.endAt) {
      legacyProjectionByUser.set(userId, {
        source: 'subscriptions',
        planId: row.planId,
        planName: row.planName,
        startAt: row.startDate,
        endAt: row.endDate,
      });
    }
  }
  for (const row of legacyActiveUsers) {
    legacyProjectionByUser.set(String(row._id), {
      source: 'users.subscription',
      planId: row.subscription.planId,
      planName: row.subscription.planName,
      startAt: row.subscription.startDate,
      endAt: row.subscription.endDate,
    });
  }
  const dateValue = (value) => (value instanceof Date ? value.getTime() : null);
  const entitlementBlockers = [...legacyActiveUserIds]
    .map((userId) => {
      const account = accountsByUser.get(userId);
      const legacy = legacyProjectionByUser.get(userId);
      const missing = [
        ...(account ? [] : ['account']),
        ...(grantUsers.has(userId) ? [] : ['grant']),
      ];
      const projectionMismatch = Boolean(
        account &&
        legacy &&
        (account.perpetual === true ||
          account.planId !== legacy.planId ||
          dateValue(account.currentStartAt) !== dateValue(legacy.startAt) ||
          dateValue(account.currentEndAt) !== dateValue(legacy.endAt)),
      );
      return {
        userId,
        missing,
        ...(projectionMismatch
          ? {
              projectionMismatch: {
                legacy: {
                  source: legacy.source,
                  planId: legacy.planId,
                  startAt: legacy.startAt,
                  endAt: legacy.endAt,
                },
                canonical: {
                  planId: account.planId,
                  currentStartAt: account.currentStartAt,
                  currentEndAt: account.currentEndAt,
                  perpetual: account.perpetual,
                },
              },
            }
          : {}),
      };
    })
    .filter((row) => row.missing.length > 0 || row.projectionMismatch)
    .sort((left, right) => left.userId.localeCompare(right.userId));

  const summary = {
    folderTargets: folderTargets.map((row) => ({
      owner: String(row.owner),
      quiz: String(row.quiz),
      folder: String(row.folder),
    })),
    bookmarkTargets: bookmarkTargets.map((row) => ({
      userId: row.userId,
      quizSlug: row.quiz.slug,
      questionIndex: row.questionIndex,
    })),
    entitlementBlockers,
    legacyUserSubscriptionCount: await db
      .collection('users')
      .countDocuments({ subscription: { $exists: true } }),
    legacyQuestionBookmarkFieldCount: await db
      .collection('questionprogresses')
      .countDocuments({ isBookmarked: { $exists: true } }),
    legacyQuizFolderFieldCount: await db
      .collection('quizzes')
      .countDocuments({ folder: { $exists: true } }),
    legacySubscriptionRowCount: await db.collection('subscriptions').countDocuments(),
    legacyPremiumReviewJobCount: await db.collection('premiumreviewjobs').countDocuments(),
  };
  return { folderTargets, bookmarkTargets, summary, checksum: checksum(summary) };
}

async function verifyCutover(db) {
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name),
  );
  const result = {
    usersSubscription: await db
      .collection('users')
      .countDocuments({ subscription: { $exists: true } }),
    questionProgressBookmark: await db
      .collection('questionprogresses')
      .countDocuments({ isBookmarked: { $exists: true } }),
    quizFolder: await db.collection('quizzes').countDocuments({ folder: { $exists: true } }),
    subscriptionsCollectionActive: collections.has('subscriptions'),
    premiumReviewJobsCollectionActive: collections.has('premiumreviewjobs'),
  };
  if (Object.values(result).some(Boolean))
    throw new Error(`Single-source verification failed: ${JSON.stringify(result)}`);
  return result;
}

async function applyPlan(db, client, plan) {
  if (!CONFIRM_RETIRE) throw new Error('--apply requires --confirm-retire-legacy');
  const missingCanonicalFacts = plan.summary.entitlementBlockers.filter(
    (row) => row.missing.length > 0,
  );
  if (missingCanonicalFacts.length > 0) {
    throw new Error(
      `Legacy active entitlements are missing canonical grants/accounts: ${JSON.stringify(missingCanonicalFacts)}`,
    );
  }
  const projectionMismatches = plan.summary.entitlementBlockers.filter(
    (row) => row.projectionMismatch,
  );
  if (projectionMismatches.length > 0 && !CONFIRM_DISCARD_ENTITLEMENT_MISMATCH) {
    throw new Error(
      `Legacy entitlement projections disagree with canonical facts; pass --confirm-discard-entitlement-mismatch only after an explicit operator decision: ${JSON.stringify(projectionMismatches)}`,
    );
  }
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name),
  );
  const sourceArchives = Object.entries(ARCHIVES).filter(([source]) => existing.has(source));
  if (!CONFIRM_DELETE_LEGACY_COLLECTIONS) {
    for (const [, archive] of sourceArchives) {
      if (existing.has(archive)) throw new Error(`Archive target already exists: ${archive}`);
    }
  }

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      if (plan.folderTargets.length > 0) {
        await db.collection('folderquizzes').bulkWrite(
          plan.folderTargets.map((row) => ({
            updateOne: {
              filter: { owner: row.owner, quiz: row.quiz },
              update: { $set: { folder: row.folder } },
              upsert: true,
            },
          })),
          { ordered: true, session },
        );
      }
      if (plan.bookmarkTargets.length > 0) {
        await db.collection('bookmarks').bulkWrite(
          plan.bookmarkTargets.map((row) => ({
            updateOne: {
              filter: {
                userId: row.userId,
                'quiz.slug': row.quiz.slug,
                questionIndex: row.questionIndex,
              },
              update: { $setOnInsert: row },
              upsert: true,
            },
          })),
          { ordered: true, session },
        );
      }
      await db
        .collection('quizzes')
        .updateMany({ folder: { $exists: true } }, { $unset: { folder: '' } }, { session });
      await db
        .collection('questionprogresses')
        .updateMany(
          { isBookmarked: { $exists: true } },
          { $unset: { isBookmarked: '' } },
          { session },
        );
      await db
        .collection('users')
        .updateMany(
          { subscription: { $exists: true } },
          { $unset: { subscription: '' } },
          { session },
        );
    });
  } finally {
    await session.endSession();
  }

  for (const [source, archive] of sourceArchives) {
    if (CONFIRM_DELETE_LEGACY_COLLECTIONS) {
      await db.collection(source).drop();
    } else {
      await db.collection(source).rename(archive, { dropTarget: false });
    }
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    if (VERIFY) {
      console.log(JSON.stringify({ mode: 'verify', result: await verifyCutover(db) }, null, 2));
      return;
    }
    const plan = await buildPlan(db);
    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          checksum: plan.checksum,
          legacyCollectionRetirement: CONFIRM_DELETE_LEGACY_COLLECTIONS ? 'delete' : 'archive',
          discardEntitlementMismatch: CONFIRM_DISCARD_ENTITLEMENT_MISMATCH,
          ...plan.summary,
        },
        null,
        2,
      ),
    );
    if (!APPLY) return;
    await applyPlan(db, client, plan);
    console.log(
      JSON.stringify({ mode: 'verify-after-apply', result: await verifyCutover(db) }, null, 2),
    );
  } finally {
    await client.close();
  }
}

await main();
