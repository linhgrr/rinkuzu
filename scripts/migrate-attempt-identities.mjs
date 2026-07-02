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
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

await mongoose.connect(uri);
try {
  const attempts = mongoose.connection.db?.collection('attempts');
  if (!attempts) throw new Error('MongoDB connection is not ready');

  const [
    stringObjectIds,
    stringEmails,
    incompatibleStrings,
    conflictingIdentities,
    legacyAnonymous,
  ] = await Promise.all([
    attempts.countDocuments({
      user: { $type: 'string', $regex: objectIdPattern },
    }),
    attempts.countDocuments({
      user: { $type: 'string', $regex: emailPattern },
    }),
    attempts.countDocuments({
      user: { $type: 'string' },
      $nor: [{ user: { $regex: objectIdPattern } }, { user: { $regex: emailPattern } }],
    }),
    attempts.countDocuments({
      user: { $exists: true },
      guestEmail: { $exists: true },
    }),
    attempts.countDocuments({
      user: null,
      guestEmail: { $exists: false },
    }),
  ]);

  if (incompatibleStrings > 0 || conflictingIdentities > 0) {
    throw new Error(
      `Unsafe attempt identities detected: ${incompatibleStrings} incompatible string(s), ${conflictingIdentities} conflicting record(s)`,
    );
  }

  if (!apply) {
    process.stdout.write(
      `Dry run: ${stringObjectIds} string ObjectId(s) and ${stringEmails} guest email(s) require migration; ${legacyAnonymous} explicitly anonymous legacy record(s) cannot be attributed.\n`,
    );
  } else {
    const objectIdResult = await attempts.updateMany(
      { user: { $type: 'string', $regex: objectIdPattern } },
      [{ $set: { user: { $toObjectId: '$user' } } }],
    );
    const emailResult = await attempts.updateMany(
      { user: { $type: 'string', $regex: emailPattern } },
      [
        {
          $set: {
            guestEmail: { $toLower: '$user' },
            user: '$$REMOVE',
          },
        },
      ],
    );

    process.stdout.write(
      `Migrated ${objectIdResult.modifiedCount} registered attempt(s) and ${emailResult.modifiedCount} guest attempt(s); preserved ${legacyAnonymous} explicitly anonymous legacy record(s).\n`,
    );
  }
} finally {
  await mongoose.disconnect();
}
