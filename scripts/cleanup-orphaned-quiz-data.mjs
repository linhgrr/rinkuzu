import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;

/** @type {ReadonlyArray<{ collection: string, localField: string, foreignField?: string, foreignExpression?: string }>} */
export const ORPHAN_QUIZ_DATA_REFERENCES = [
  { collection: 'attempts', localField: 'quiz', foreignField: '_id' },
  { collection: 'discussions', localField: 'quiz', foreignField: '_id' },
  { collection: 'folderquizzes', localField: 'quiz', foreignField: '_id' },
  { collection: 'quizprogresses', localField: 'quiz', foreignField: '_id' },
  { collection: 'reports', localField: 'quizId', foreignExpression: 'idAsString' },
  { collection: 'bookmarks', localField: 'quiz.slug', foreignField: 'slug' },
  { collection: 'questionprogresses', localField: 'quizSlug', foreignField: 'slug' },
];

/**
 * @param {{ collection: string, localField: string, foreignField?: string, foreignExpression?: string }} reference
 */
function lookupStage(reference) {
  if (reference.foreignExpression === 'idAsString') {
    return {
      $lookup: {
        from: 'quizzes',
        let: { quizId: `$${reference.localField}` },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: '$_id' }, '$$quizId'] },
            },
          },
          { $limit: 1 },
        ],
        as: 'referencedQuiz',
      },
    };
  }

  return {
    $lookup: {
      from: 'quizzes',
      localField: reference.localField,
      foreignField: reference.foreignField,
      as: 'referencedQuiz',
    },
  };
}

/**
 * @param {import('mongodb').Db} db
 * @param {{ collection: string, localField: string, foreignField?: string, foreignExpression?: string }} reference
 * @param {{ session?: import('mongodb').ClientSession }} [options]
 */
export async function findOrphanIds(db, reference, options = {}) {
  const { session } = options;
  /** @type {import('mongodb').AggregateOptions} */
  const aggregateOptions = session ? { session } : {};

  return db
    .collection(reference.collection)
    .aggregate(
      [
        { $match: { [reference.localField]: { $exists: true, $ne: null } } },
        lookupStage(reference),
        { $match: { referencedQuiz: { $eq: [] } } },
        { $project: { _id: 1 } },
      ],
      aggregateOptions,
    )
    .map((document) => document._id)
    .toArray();
}

/**
 * @param {unknown[]} ids
 * @returns {unknown[]}
 */
function sortIds(ids) {
  return [...ids].sort((left, right) => String(left).localeCompare(String(right)));
}

/**
 * Deterministic SHA-256 over per-collection orphan id sets (sorted by collection + id string).
 * IDs are used only for fingerprinting; callers must not print them in normal CLI output.
 * @param {Record<string, unknown[]>} orphanIdsByCollection
 * @returns {string}
 */
export function createOrphanedQuizDataPlanSha(orphanIdsByCollection) {
  const normalized = Object.fromEntries(
    Object.keys(orphanIdsByCollection)
      .sort()
      .map((collection) => [
        collection,
        orphanIdsByCollection[collection].map(String).sort((a, b) => a.localeCompare(b)),
      ]),
  );
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Public check report: aggregate counts + plan SHA only (no IDs / document contents / PII).
 * @param {{
 *   counts: Record<string, number>,
 *   total: number,
 *   planSha: string,
 * }} plan
 * @param {string} databaseName
 */
export function buildOrphanedQuizDataCheckReport(plan, databaseName) {
  return {
    mode: 'check',
    databaseName,
    collections: plan.counts,
    total: plan.total,
    planSha: plan.planSha,
    ok: plan.total === 0,
  };
}

/**
 * Exit 0 only when the aggregate orphan total is zero (fail closed otherwise).
 * @param {{ total: number }} plan
 * @returns {0 | 1}
 */
export function getOrphanedQuizDataCheckExitCode(plan) {
  return plan.total === 0 ? 0 : 1;
}

/**
 * Build a complete orphan reconciliation plan across all reference collections.
 * Fails closed when quizzes or any reference collection is missing.
 * Optional session is propagated to listCollections and aggregation (read-only).
 * Internal orphanIds are retained only for exact fingerprinting — never print them.
 * @param {import('mongodb').Db} db
 * @param {{ session?: import('mongodb').ClientSession, skipCollectionCheck?: boolean }} [options]
 */
export async function inspectOrphanedQuizData(db, options = {}) {
  const { session, skipCollectionCheck = false } = options;
  /** @type {import('mongodb').ListCollectionsOptions} */
  const listOptions = session ? { nameOnly: true, session } : { nameOnly: true };

  if (!skipCollectionCheck) {
    const existingCollections = new Set(
      (await db.listCollections({}, listOptions).toArray()).map(({ name }) => name),
    );

    if (!existingCollections.has('quizzes')) {
      throw new Error('quizzes collection is required');
    }

    const missing = ORPHAN_QUIZ_DATA_REFERENCES.map((reference) => reference.collection).filter(
      (name) => !existingCollections.has(name),
    );
    if (missing.length > 0) {
      throw new Error(`Missing required collections: ${missing.join(', ')}`);
    }
  }

  /** @type {Array<{ collection: string, orphanIds: unknown[], count: number }>} */
  const collections = [];
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, unknown[]>} */
  const orphanIdsByCollection = {};
  let total = 0;

  // Sequential aggregation keeps inspection deterministic and session-safe.
  for (const reference of ORPHAN_QUIZ_DATA_REFERENCES) {
    const orphanIds = sortIds(await findOrphanIds(db, reference, options));
    collections.push({
      collection: reference.collection,
      orphanIds,
      count: orphanIds.length,
    });
    counts[reference.collection] = orphanIds.length;
    orphanIdsByCollection[reference.collection] = orphanIds;
    total += orphanIds.length;
  }

  return {
    collections,
    counts,
    total,
    planSha: createOrphanedQuizDataPlanSha(orphanIdsByCollection),
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  // Strictly read-only reconciliation: CLI flags cannot enable mutation.
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();
    const plan = await inspectOrphanedQuizData(db);
    const report = buildOrphanedQuizDataCheckReport(plan, db.databaseName);

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = getOrphanedQuizDataCheckExitCode(plan);
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
