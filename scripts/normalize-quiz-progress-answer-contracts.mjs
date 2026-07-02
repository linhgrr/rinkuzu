/* eslint-disable no-console */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { normalizeSelectedAnswer } from './lib/normalize-selected-answer.mjs';

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
  const cursor = quizProgress.find(
    {
      userAnswers: {
        $elemMatch: {
          $not: {
            $type: 'object',
          },
        },
      },
    },
    {
      projection: {
        _id: 1,
        userAnswers: 1,
      },
    },
  );

  const operations = [];
  const invalid = [];

  for await (const record of cursor) {
    try {
      const normalizedAnswers = record.userAnswers.map((answer) =>
        normalizeSelectedAnswer(answer, 'quiz progress answer'),
      );
      operations.push({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { userAnswers: normalizedAnswers } },
        },
      });
    } catch (error) {
      invalid.push({
        id: String(record._id),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (invalid.length > 0) {
    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          pending: operations.length,
          invalid,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } else {
    if (shouldApply && operations.length > 0) {
      await quizProgress.bulkWrite(operations, { ordered: false });
    }

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          pending: operations.length,
          converted: shouldApply ? operations.length : 0,
          invalid,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await client.close();
}
