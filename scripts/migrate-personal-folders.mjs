import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI;
if (!uri) {
  process.stderr.write('MONGODB_URI is required\n');
  process.exit(1);
}

await mongoose.connect(uri);
try {
  const result = await mongoose.connection.collection('quizzes').updateMany(
    {},
    {
      $unset: { category: '' },
      $set: { folder: null },
    },
  );
  process.stdout.write(`Migrated ${result.modifiedCount} of ${result.matchedCount} quizzes\n`);
} finally {
  await mongoose.disconnect();
}
