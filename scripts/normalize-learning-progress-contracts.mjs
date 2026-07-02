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

  const missingLastSessionDate = await userProgress.countDocuments({
    lastSessionDate: { $exists: false },
  });

  if (!apply) {
    process.stdout.write(
      `Dry run: ${missingLastSessionDate} user progress record(s) require lastSessionDate normalization.\n`,
    );
  } else {
    const result = await userProgress.updateMany(
      { lastSessionDate: { $exists: false } },
      { $set: { lastSessionDate: null } },
    );
    process.stdout.write(`Normalized ${result.modifiedCount} user progress record(s).\n`);
  }
} finally {
  await mongoose.disconnect();
}
