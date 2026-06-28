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

await mongoose.connect(uri);
try {
  const quizzes = mongoose.connection.db?.collection('quizzes');
  if (!quizzes) throw new Error('MongoDB connection is not ready');

  const affected = await quizzes.countDocuments({
    $or: [{ status: { $exists: true } }, { reviewNote: { $exists: true } }],
  });

  if (!apply) {
    process.stdout.write(
      `Dry run: ${affected} quiz record(s) still contain approval fields. Re-run with --apply to remove them.\n`,
    );
  } else {
    const result = await quizzes.updateMany(
      {},
      {
        $unset: {
          status: '',
          reviewNote: '',
        },
      },
    );
    process.stdout.write(
      `Removed approval fields from ${result.modifiedCount} of ${result.matchedCount} quiz record(s).\n`,
    );
  }
} finally {
  await mongoose.disconnect();
}
