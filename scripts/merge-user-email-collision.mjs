import process from 'node:process';

import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';

import { readCliOptions } from './cli-options.shared.mjs';

const { loadEnvConfig } = nextEnv;
const REFERENCE_FIELDS = [
  ['attempts', 'user'],
  ['auditlogs', 'userId'],
  ['discussions', 'author'],
  ['folderquizzes', 'owner'],
  ['folders', 'owner'],
  ['quizprogresses', 'userId'],
  ['quizzes', 'author'],
  ['subscriptions', 'user'],
  ['users', 'disabledBy'],
];

function canonicalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requireObjectId(value, name) {
  if (!value || !ObjectId.isValid(value)) throw new Error(`--${name}=<ObjectId> is required`);
  return new ObjectId(value);
}

function mergeIdentities(survivor, duplicate) {
  const byKey = new Map();
  for (const identity of [...(survivor ?? []), ...(duplicate ?? [])]) {
    if (!identity?.provider || !identity?.subject) continue;
    byKey.set(`${identity.provider}:${identity.subject}`, {
      provider: identity.provider,
      subject: identity.subject,
    });
  }
  return [...byKey.values()];
}

async function main() {
  const options = readCliOptions({
    apply: { type: 'boolean', default: false },
    survivor: { type: 'string' },
    duplicate: { type: 'string' },
  });
  const survivorId = requireObjectId(options.survivor, 'survivor');
  const duplicateId = requireObjectId(options.duplicate, 'duplicate');
  const apply = options.apply;
  if (survivorId.equals(duplicateId)) throw new Error('Survivor and duplicate must differ');

  loadEnvConfig(process.cwd());
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in .env');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  try {
    const db = client.db();
    const users = db.collection('users');
    const [survivor, duplicate] = await Promise.all([
      users.findOne({ _id: survivorId }),
      users.findOne({ _id: duplicateId }),
    ]);
    if (!survivor || !duplicate) throw new Error('Both user documents must exist');

    const canonical = canonicalizeEmail(survivor.email);
    if (!canonical || canonical !== canonicalizeEmail(duplicate.email)) {
      throw new Error('Users do not share the same canonical email');
    }
    if (survivor.disable !== 0) throw new Error('Survivor must be active');

    const references = [];
    for (const [collectionName, field] of REFERENCE_FIELDS) {
      const count = await db.collection(collectionName).countDocuments({ [field]: duplicateId });
      if (count > 0) references.push({ collection: collectionName, field, count });
    }

    const plan = {
      canonicalEmail: canonical,
      survivorId: String(survivorId),
      duplicateId: String(duplicateId),
      survivorRole: survivor.role,
      duplicateRole: duplicate.role,
      duplicateReferences: references,
      passwordPolicy: survivor.password ? 'keep_survivor' : 'adopt_duplicate',
      authIdentityCount: mergeIdentities(survivor.authIdentities, duplicate.authIdentities).length,
    };
    console.log(JSON.stringify(plan, null, 2));
    if (!apply) {
      console.log('Dry run only. Re-run with the same IDs and --apply.');
      return;
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const [collectionName, field] of REFERENCE_FIELDS) {
          await db
            .collection(collectionName)
            .updateMany({ [field]: duplicateId }, { $set: { [field]: survivorId } }, { session });
        }

        const authIdentities = mergeIdentities(survivor.authIdentities, duplicate.authIdentities);
        await users.updateOne(
          { _id: survivorId, email: survivor.email },
          {
            $set: {
              email: canonical,
              authVersion: Math.max(survivor.authVersion ?? 0, duplicate.authVersion ?? 0) + 1,
              ...(authIdentities.length > 0 ? { authIdentities } : {}),
              ...(!survivor.password && duplicate.password ? { password: duplicate.password } : {}),
              ...(!survivor.emailVerified && duplicate.emailVerified
                ? { emailVerified: duplicate.emailVerified }
                : {}),
              ...(!survivor.displayName && duplicate.displayName
                ? { displayName: duplicate.displayName }
                : {}),
              ...(!survivor.avatar && duplicate.avatar ? { avatar: duplicate.avatar } : {}),
            },
          },
          { session },
        );
        const deleted = await users.deleteOne({ _id: duplicateId }, { session });
        if (deleted.deletedCount !== 1) throw new Error('Duplicate deletion failed');
      });
    } finally {
      await session.endSession();
    }
    console.log('Collision merged transactionally and survivor sessions were revoked');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
