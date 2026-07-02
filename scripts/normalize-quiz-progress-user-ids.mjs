/* eslint-disable no-console */
import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';

config({ path: '.env' });

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
const shouldApply = process.argv.includes('--apply');

if (!uri) {
  throw new Error('Missing MongoDB connection string');
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  const quizProgress = db.collection('quizprogresses');

  const candidates = await quizProgress
    .find({ userId: { $type: 'string' } }, { projection: { _id: 1, userId: 1 } })
    .toArray();

  const convertible = candidates.filter((record) => ObjectId.isValid(record.userId));
  const invalid = candidates.filter((record) => !ObjectId.isValid(record.userId));

  if (shouldApply && convertible.length > 0) {
    const operations = convertible.map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { userId: new ObjectId(record.userId) } },
      },
    }));
    await quizProgress.bulkWrite(operations, { ordered: false });
  }

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? 'apply' : 'dry-run',
        stringUserIdRecords: candidates.length,
        converted: shouldApply ? convertible.length : 0,
        convertible: convertible.length,
        invalid: invalid.map((record) => ({ id: String(record._id), userId: record.userId })),
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
