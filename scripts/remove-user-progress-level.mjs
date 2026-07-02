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
  const userProgress = mongoose.connection.db?.collection('userprogresses');
  if (!userProgress) throw new Error('MongoDB connection is not ready');

  const affected = await userProgress.countDocuments({
    level: { $exists: true },
  });

  if (!apply) {
    process.stdout.write(
      `Dry run: ${affected} user progress record(s) contain deprecated level data.\n`,
    );
  } else {
    const result = await userProgress.updateMany(
      { level: { $exists: true } },
      { $unset: { level: '' } },
    );
    process.stdout.write(
      `Removed deprecated level data from ${result.modifiedCount} user progress record(s).\n`,
    );
  }
} finally {
  await mongoose.disconnect();
}
