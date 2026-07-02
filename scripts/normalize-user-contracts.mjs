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
  const users = mongoose.connection.db?.collection('users');
  if (!users) throw new Error('MongoDB connection is not ready');

  const [missingRoles, obsoleteAnonymousFlags, emptySubscriptions] = await Promise.all([
    users.countDocuments({ role: { $exists: false } }),
    users.countDocuments({ isAnonymous: { $exists: true } }),
    users.countDocuments({
      subscription: { $exists: true },
      'subscription.type': { $exists: false },
    }),
  ]);

  if (!apply) {
    process.stdout.write(
      `Dry run: ${missingRoles} missing role(s), ${obsoleteAnonymousFlags} obsolete isAnonymous flag(s), ${emptySubscriptions} empty subscription(s).\n`,
    );
  } else {
    const [roleResult, anonymousResult, subscriptionResult] = await Promise.all([
      users.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } }),
      users.updateMany({ isAnonymous: { $exists: true } }, { $unset: { isAnonymous: '' } }),
      users.updateMany(
        {
          subscription: { $exists: true },
          'subscription.type': { $exists: false },
        },
        { $unset: { subscription: '' } },
      ),
    ]);
    process.stdout.write(
      `Normalized ${roleResult.modifiedCount} role(s), removed ${anonymousResult.modifiedCount} isAnonymous flag(s), and removed ${subscriptionResult.modifiedCount} empty subscription(s).\n`,
    );
  }
} finally {
  await mongoose.disconnect();
}
