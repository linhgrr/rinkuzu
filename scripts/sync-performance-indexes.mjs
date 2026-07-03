/* eslint-disable no-console */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config({ path: '.env' });

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
const shouldApply = process.argv.includes('--apply');

if (!uri) {
  throw new Error('Missing MongoDB connection string');
}

const recentListIndexes = [
  {
    collection: 'reports',
    key: { createdAt: -1 },
    name: 'createdAt_-1',
  },
  {
    collection: 'subscriptions',
    key: { createdAt: -1 },
    name: 'createdAt_-1',
  },
];
const discussionKey = { quiz: 1, questionIndex: 1 };

function hasKey(index, key) {
  const expected = Object.entries(key);
  const actual = Object.entries(index.key);
  return (
    actual.length === expected.length &&
    expected.every(([field, direction]) => index.key[field] === direction)
  );
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  const actions = [];

  for (const desired of recentListIndexes) {
    const collection = db.collection(desired.collection);
    const indexes = await collection.indexes();
    const existing = indexes.find((index) => hasKey(index, desired.key));
    actions.push({
      collection: desired.collection,
      index: desired.name,
      action: existing ? 'unchanged' : shouldApply ? 'created' : 'create',
    });

    if (shouldApply && !existing) {
      await collection.createIndex(desired.key, { name: desired.name });
    }
  }

  const discussions = db.collection('discussions');
  const duplicateGroups = await discussions
    .aggregate([
      {
        $group: {
          _id: { quiz: '$quiz', questionIndex: '$questionIndex' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ])
    .toArray();
  const duplicateCount = duplicateGroups[0]?.count ?? 0;
  const discussionIndexes = await discussions.indexes();
  const discussionIndex = discussionIndexes.find((index) => hasKey(index, discussionKey));

  if (duplicateCount > 0) {
    throw new Error(
      `Cannot enforce unique discussion index: found ${duplicateCount} duplicate quiz/question group(s)`,
    );
  }

  if (!discussionIndex) {
    actions.push({
      collection: 'discussions',
      index: 'quiz_1_questionIndex_1',
      action: shouldApply ? 'created_unique' : 'create_unique',
    });
    if (shouldApply) {
      await discussions.createIndex(discussionKey, {
        name: 'quiz_1_questionIndex_1',
        unique: true,
      });
    }
  } else if (!discussionIndex.unique) {
    if (shouldApply) {
      let action = 'converted_to_unique';
      try {
        await db.command({
          collMod: 'discussions',
          index: { keyPattern: discussionKey, prepareUnique: true },
        });
        await db.command({
          collMod: 'discussions',
          index: { keyPattern: discussionKey, unique: true },
        });
      } catch (error) {
        const canFallback =
          error &&
          typeof error === 'object' &&
          ('code' in error || 'codeName' in error) &&
          (error.code === 13 ||
            (error.code === 8000 &&
              'message' in error &&
              /not allowed.*collMod/i.test(String(error.message))) ||
            error.codeName === 'Unauthorized' ||
            error.codeName === 'Unauthorized');
        if (!canFallback) throw error;

        action = 'rebuilt_as_unique';
        await discussions.dropIndex(discussionIndex.name);
        try {
          await discussions.createIndex(discussionKey, {
            name: discussionIndex.name,
            unique: true,
          });
        } catch (createError) {
          await discussions.createIndex(discussionKey, { name: discussionIndex.name });
          throw createError;
        }
      }
      actions.push({
        collection: 'discussions',
        index: discussionIndex.name,
        action,
      });
    } else {
      actions.push({
        collection: 'discussions',
        index: discussionIndex.name,
        action: 'convert_to_unique',
      });
    }
  } else {
    actions.push({
      collection: 'discussions',
      index: discussionIndex.name,
      action: 'unchanged_unique',
    });
  }

  const verified = shouldApply
    ? {
        reportsCreatedAt: (await db.collection('reports').indexes()).some((index) =>
          hasKey(index, { createdAt: -1 }),
        ),
        subscriptionsCreatedAt: (await db.collection('subscriptions').indexes()).some((index) =>
          hasKey(index, { createdAt: -1 }),
        ),
        discussionsUnique: (await discussions.indexes()).some(
          (index) => hasKey(index, discussionKey) && index.unique === true,
        ),
      }
    : undefined;

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? 'apply' : 'dry-run',
        duplicateDiscussionGroups: duplicateCount,
        actions,
        verified,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
