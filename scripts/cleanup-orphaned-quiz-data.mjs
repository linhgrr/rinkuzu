import nextEnv from '@next/env';
import mongoose from 'mongoose';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI;
if (!uri) {
  process.stderr.write('MONGODB_URI is required\n');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const references = [
  { collection: 'attempts', localField: 'quiz', foreignField: '_id' },
  { collection: 'discussions', localField: 'quiz', foreignField: '_id' },
  { collection: 'folderquizzes', localField: 'quiz', foreignField: '_id' },
  { collection: 'quizprogresses', localField: 'quiz', foreignField: '_id' },
  { collection: 'reports', localField: 'quizId', foreignExpression: 'idAsString' },
  { collection: 'bookmarks', localField: 'quiz.slug', foreignField: 'slug' },
  { collection: 'questionprogresses', localField: 'quizSlug', foreignField: 'slug' },
];

function lookupStage(reference) {
  if (reference.foreignExpression === 'idAsString') {
    return {
      $lookup: {
        from: 'quizzes',
        let: { quizId: `$${reference.localField}` },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: '$_id' }, '$$quizId'] },
            },
          },
          { $limit: 1 },
        ],
        as: 'referencedQuiz',
      },
    };
  }

  return {
    $lookup: {
      from: 'quizzes',
      localField: reference.localField,
      foreignField: reference.foreignField,
      as: 'referencedQuiz',
    },
  };
}

async function findOrphanIds(db, reference) {
  return db
    .collection(reference.collection)
    .aggregate([
      { $match: { [reference.localField]: { $exists: true, $ne: null } } },
      lookupStage(reference),
      { $match: { referencedQuiz: { $eq: [] } } },
      { $project: { _id: 1 } },
    ])
    .map((document) => document._id)
    .toArray();
}

await mongoose.connect(uri);
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  let total = 0;

  for (const reference of references) {
    if (!existingCollections.has(reference.collection)) {
      process.stdout.write(`${reference.collection}: skipped (collection not found)\n`);
      continue;
    }

    const orphanIds = await findOrphanIds(db, reference);
    total += orphanIds.length;

    if (apply && orphanIds.length > 0) {
      const result = await db.collection(reference.collection).deleteMany({
        _id: { $in: orphanIds },
      });
      process.stdout.write(`${reference.collection}: deleted ${result.deletedCount}\n`);
    } else {
      process.stdout.write(`${reference.collection}: found ${orphanIds.length} orphan(s)\n`);
    }
  }

  process.stdout.write(
    apply
      ? `Cleanup complete: processed ${total} orphan(s)\n`
      : `Dry run complete: found ${total} orphan(s). Re-run with --apply to delete them.\n`,
  );
} finally {
  await mongoose.disconnect();
}
