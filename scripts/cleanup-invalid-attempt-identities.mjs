import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

import { readCliOptions } from './cli-options.shared.mjs';

const { loadEnvConfig } = nextEnv;
const GUEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_MAX_DELETE = 100;
const CLEANUP_COMMENT = 'cleanup-invalid-attempt-identities-v1';

export function createAttemptIdentityPlanSha({ unattributedIds, danglingUserIds }) {
  const normalized = {
    danglingUserIds: danglingUserIds.map(String).sort(),
    unattributedIds: unattributedIds.map(String).sort(),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function validateAttemptIdentityCleanup({ apply, approvedPlanSha, maxDelete, plan }) {
  if (!Number.isSafeInteger(maxDelete) || maxDelete < 1) {
    throw new Error('--max-delete must be a positive safe integer');
  }
  if (!apply || plan.total === 0) return;
  if (plan.total > maxDelete) {
    throw new Error(
      `Cleanup plan contains ${plan.total} rows, above the --max-delete limit of ${maxDelete}`,
    );
  }
  if (!approvedPlanSha) {
    throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
  }
  if (approvedPlanSha !== plan.planSha) {
    throw new Error('Approved plan SHA does not match the current cleanup plan');
  }
}

export async function inspectAttemptIdentityCleanup(db) {
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  if (!collections.has('attempts') || !collections.has('users')) {
    throw new Error('Both attempts and users collections are required');
  }

  const attempts = db.collection('attempts');
  const [unattributed, danglingUserAttempts, conflicting, unsupportedUsers, invalidGuests] =
    await Promise.all([
      attempts
        .find(
          {
            $and: [
              { $or: [{ user: { $exists: false } }, { user: null }] },
              {
                $or: [{ guestEmail: { $exists: false } }, { guestEmail: null }, { guestEmail: '' }],
              },
            ],
          },
          { projection: { _id: 1 } },
        )
        .toArray(),
      attempts
        .aggregate([
          { $match: { user: { $type: 'objectId' } } },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              pipeline: [{ $project: { _id: 1 } }],
              as: 'owner',
            },
          },
          { $match: { owner: { $eq: [] } } },
          { $project: { _id: 1 } },
        ])
        .toArray(),
      attempts.countDocuments({
        user: { $exists: true, $ne: null },
        guestEmail: { $exists: true, $ne: null },
      }),
      attempts.countDocuments({
        user: { $exists: true, $ne: null, $not: { $type: 'objectId' } },
      }),
      attempts.countDocuments({
        guestEmail: {
          $exists: true,
          $ne: null,
          $not: GUEST_EMAIL_PATTERN,
        },
      }),
    ]);

  const unsafeCount = conflicting + unsupportedUsers + invalidGuests;
  if (unsafeCount > 0) {
    throw new Error(
      `Unsafe attempt identities require normalization before cleanup: ${conflicting} conflicting, ${unsupportedUsers} unsupported user, ${invalidGuests} invalid guest`,
    );
  }

  const unattributedIds = unattributed.map(({ _id }) => _id);
  const danglingUserIds = danglingUserAttempts.map(({ _id }) => _id);
  return {
    unattributedIds,
    danglingUserIds,
    unattributed: unattributedIds.length,
    danglingUsers: danglingUserIds.length,
    total: unattributedIds.length + danglingUserIds.length,
    planSha: createAttemptIdentityPlanSha({ unattributedIds, danglingUserIds }),
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const options = readCliOptions({
    apply: { type: 'boolean', default: false },
    'approve-plan': { type: 'string' },
    'max-delete': { type: 'string' },
  });
  const apply = options.apply;
  const approvedPlanSha = options['approve-plan'];
  const maxDeleteRaw = options['max-delete'];
  const maxDelete = maxDeleteRaw === undefined ? DEFAULT_MAX_DELETE : Number(maxDeleteRaw);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();
    const plan = await inspectAttemptIdentityCleanup(db);
    validateAttemptIdentityCleanup({ apply, approvedPlanSha, maxDelete, plan });

    let deleted = 0;
    if (apply && plan.total > 0) {
      const candidateIds = [...plan.unattributedIds, ...plan.danglingUserIds];
      const result = await db
        .collection('attempts')
        .deleteMany({ _id: { $in: candidateIds } }, { comment: CLEANUP_COMMENT });
      deleted = result.deletedCount;
      if (deleted !== plan.total) {
        throw new Error(`Deleted ${deleted} rows but the approved plan contained ${plan.total}`);
      }

      const verification = await inspectAttemptIdentityCleanup(db);
      if (verification.total !== 0) {
        throw new Error(`Post-apply verification found ${verification.total} invalid attempt rows`);
      }
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          unattributed: plan.unattributed,
          danglingUsers: plan.danglingUsers,
          total: plan.total,
          planSha: plan.planSha,
          maxDelete,
          deleted,
          verified: apply ? deleted === plan.total : undefined,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
