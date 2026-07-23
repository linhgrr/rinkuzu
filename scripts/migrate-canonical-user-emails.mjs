import process from 'node:process';

import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const verifyOnly = args.has('--verify');

function canonicalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function assertMode() {
  const known = new Set(['--apply', '--verify']);
  const unknown = [...args].filter((arg) => !known.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  if (apply && verifyOnly) throw new Error('Choose either --apply or --verify');
}

async function inspect(users) {
  const rows = await users
    .find({}, { projection: { _id: 1, email: 1 } })
    .sort({ _id: 1 })
    .toArray();
  const canonicalOwners = new Map();
  const invalid = [];
  const changes = [];

  for (const row of rows) {
    const canonical = canonicalizeEmail(row.email);
    if (!canonical || canonical.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(canonical)) {
      invalid.push({ id: String(row._id), email: row.email ?? null });
      continue;
    }
    const owners = canonicalOwners.get(canonical) ?? [];
    owners.push({ id: String(row._id), email: row.email });
    canonicalOwners.set(canonical, owners);
    if (row.email !== canonical) {
      changes.push({ id: String(row._id), from: row.email, to: canonical });
    }
  }

  const collisions = [...canonicalOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([canonical, owners]) => ({ canonical, owners }));
  return { total: rows.length, invalid, changes, collisions };
}

async function hasAuthIdentityIndex(users) {
  const indexes = await users.listIndexes().toArray();
  return indexes.some(
    (index) =>
      index.unique === true &&
      index.key?.['authIdentities.provider'] === 1 &&
      index.key?.['authIdentities.subject'] === 1,
  );
}

function printReport(report) {
  console.log(
    JSON.stringify(
      {
        totalUsers: report.total,
        emailsToCanonicalize: report.changes.length,
        invalidEmails: report.invalid,
        canonicalCollisions: report.collisions,
      },
      null,
      2,
    ),
  );
}

async function main() {
  assertMode();
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required in the loaded .env files');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const users = db.collection('users');
    const before = await inspect(users);
    printReport(before);

    if (before.invalid.length > 0 || before.collisions.length > 0) {
      throw new Error(
        'Migration blocked: resolve invalid emails and canonical collisions explicitly; accounts are never auto-merged',
      );
    }

    if (verifyOnly) {
      if (before.changes.length > 0) {
        throw new Error('Verification failed: non-canonical emails remain');
      }
      if (!(await hasAuthIdentityIndex(users))) {
        throw new Error('Verification failed: unique external auth identity index is missing');
      }
      console.log('Verification passed: every user email is canonical and unique');
      return;
    }

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to write, then --verify.');
      return;
    }

    const result = await users.updateMany(
      {
        $expr: {
          $ne: ['$email', { $toLower: { $trim: { input: '$email' } } }],
        },
      },
      [{ $set: { email: { $toLower: { $trim: { input: '$email' } } } } }],
    );
    console.log(`Canonicalized ${result.modifiedCount} user email(s)`);
    const after = await inspect(users);
    if (after.invalid.length > 0 || after.collisions.length > 0 || after.changes.length > 0) {
      throw new Error('Postcondition failed after migration');
    }
    console.log('Postcondition passed: every user email is canonical and unique');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
