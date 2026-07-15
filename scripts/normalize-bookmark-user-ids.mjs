import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config({ path: '.env' });

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
const shouldApply = process.argv.includes('--apply');

if (!uri) {
  throw new Error('Missing MongoDB connection string');
}

const client = new MongoClient(uri);

/**
 * @typedef {object} BookmarkMigrationRecord
 * @property {import('mongodb').ObjectId} _id
 * @property {string=} userId
 * @property {string} quizSlug
 * @property {number} questionIndex
 * @property {string[]} matchedUserIds
 * @property {string=} targetUserId
 */

try {
  await client.connect();
  const db = client.db();
  const bookmarks = db.collection('bookmarks');
  const records = /** @type {BookmarkMigrationRecord[]} */ (
    await bookmarks
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userEmail',
            foreignField: 'email',
            as: 'users',
          },
        },
        {
          $project: {
            userId: 1,
            userEmail: 1,
            quizSlug: '$quiz.slug',
            questionIndex: 1,
            matchedUserIds: {
              $map: {
                input: '$users',
                as: 'user',
                in: { $toString: '$$user._id' },
              },
            },
          },
        },
      ])
      .toArray()
  );

  const invalid = records.filter((record) => record.matchedUserIds.length !== 1);
  if (invalid.length > 0) {
    throw new Error(
      `Cannot normalize bookmarks: ${invalid.length} record(s) do not map to exactly one user`,
    );
  }

  const updates = records
    .map((record) => ({ ...record, targetUserId: record.matchedUserIds[0] }))
    .filter((record) => record.userId !== record.targetUserId);
  const targetKeys = new Set();
  for (const record of records) {
    const targetUserId = record.matchedUserIds[0];
    const targetKey = `${targetUserId}:${record.quizSlug}:${record.questionIndex}`;
    if (targetKeys.has(targetKey)) {
      throw new Error(`Cannot normalize bookmarks: duplicate target key ${targetKey}`);
    }
    targetKeys.add(targetKey);
  }

  if (shouldApply && updates.length > 0) {
    await bookmarks.bulkWrite(
      updates.map((record) => ({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { userId: record.targetUserId } },
        },
      })),
      { ordered: true },
    );
  }

  const obsoleteIndexes = (await bookmarks.indexes()).filter(
    (index) => Object.keys(index.key)[0] === 'userEmail' || index.name === 'userId_1',
  );

  const canonicalCount = shouldApply
    ? await bookmarks
        .aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'userEmail',
              foreignField: 'email',
              as: 'users',
            },
          },
          {
            $match: {
              $expr: {
                $eq: ['$userId', { $toString: { $first: '$users._id' } }],
              },
            },
          },
          { $count: 'count' },
        ])
        .toArray()
    : [];

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? 'apply' : 'dry-run',
        total: records.length,
        canonicalBefore: records.length - updates.length,
        updatesRequired: updates.length,
        updated: shouldApply ? updates.length : 0,
        obsoleteIndexes: obsoleteIndexes.map((index) => index.name),
        indexMigrationRequired: obsoleteIndexes.length > 0,
        indexMigrationCommand: 'npm run migrate:performance-indexes',
        verifiedCanonical: shouldApply
          ? (canonicalCount[0]?.count ?? 0) === records.length
          : undefined,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
