import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectOrphanedQuizData } from './cleanup-orphaned-quiz-data.mjs';

import { readCliOptions } from './cli-options.shared.mjs';

const { loadEnvConfig } = nextEnv;
const DEFAULT_MAX_DELETE = 100;
const CLEANUP_COMMENT = 'delete-orphaned-quiz-data-v1';

export function validateOrphanedQuizDataDeletion({ apply, approvedPlanSha, maxDelete, plan }) {
  if (!Number.isSafeInteger(maxDelete) || maxDelete < 1) {
    throw new Error('--max-delete must be a positive safe integer');
  }
  if (!apply) throw new Error('Deletion requires --apply');
  if (plan.total === 0) return;
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
    const initialPlan = await inspectOrphanedQuizData(db);
    validateOrphanedQuizDataDeletion({ apply, approvedPlanSha, maxDelete, plan: initialPlan });

    const deletedByCollection = Object.fromEntries(
      initialPlan.collections.map(({ collection }) => [collection, 0]),
    );
    if (initialPlan.total > 0) {
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const currentPlan = await inspectOrphanedQuizData(db, {
            session,
            skipCollectionCheck: true,
          });
          validateOrphanedQuizDataDeletion({
            apply,
            approvedPlanSha,
            maxDelete,
            plan: currentPlan,
          });

          for (const { collection, orphanIds, count } of currentPlan.collections) {
            if (count === 0) continue;
            const orphanDocumentIds = /** @type {import('mongodb').ObjectId[]} */ (orphanIds);
            const result = await db
              .collection(collection)
              .deleteMany(
                { _id: { $in: orphanDocumentIds } },
                { session, comment: CLEANUP_COMMENT },
              );
            if (result.deletedCount !== count) {
              throw new Error(
                `${collection}: deleted ${result.deletedCount} rows but the approved plan contained ${count}`,
              );
            }
            deletedByCollection[collection] = result.deletedCount;
          }
        });
      } finally {
        await session.endSession();
      }
    }

    const verification = await inspectOrphanedQuizData(db);
    if (verification.total !== 0) {
      throw new Error(`Post-apply verification found ${verification.total} orphan rows`);
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'apply',
          databaseName: db.databaseName,
          approvedPlanSha: initialPlan.planSha,
          planned: initialPlan.counts,
          deleted: deletedByCollection,
          totalDeleted: Object.values(deletedByCollection).reduce((sum, count) => sum + count, 0),
          verified: true,
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
