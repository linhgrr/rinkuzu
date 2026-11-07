/**
 * RIN-1181 (spec RIN-1177): seed the `starterquizzes` collection with the three
 * starters the code used to hard-code, in the same order. Keyed on the quiz
 * `_id` (slugs change), resolved from each slug at run time.
 *
 *   node scripts/migrate-starter-quizzes.mjs              # dry run (default)
 *   node scripts/migrate-starter-quizzes.mjs --dry-run    # same, explicit
 *   node scripts/migrate-starter-quizzes.mjs --apply      # write
 *
 * Idempotent: an existing row for the quiz is left as it is, so a second run
 * (or a run after an admin reordered the list) changes nothing. Prints counts
 * only. Rollback: `db.starterquizzes.deleteMany({})`, which only these rows use.
 */
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

import { readCliOptions } from './cli-options.shared.mjs';

export const STARTER_QUIZ_COLLECTION = 'starterquizzes';

/** The former `STARTER_QUIZ_ALLOWLIST`, in its order. */
export const STARTER_QUIZ_SEED = Object.freeze([
  Object.freeze({
    slug: 'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007',
    locale: 'vi',
    order: 1,
  }),
  Object.freeze({
    slug: 'how-to-remember-what-you-study-7-question-starter-quiz-093947',
    locale: 'en',
    order: 2,
  }),
  Object.freeze({ slug: 'ktpm-chng-6-p1-219991', locale: 'vi', order: 3 }),
]);

/**
 * @typedef {{ slug: string, locale: string, order: number }} StarterSeed
 * @typedef {{
 *   findOne(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ _id: unknown } | null>,
 * }} QuizLookup
 * @typedef {{
 *   findOne(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>,
 *   updateOne(
 *     filter: Record<string, unknown>,
 *     update: Record<string, unknown>,
 *     options: Record<string, unknown>,
 *   ): Promise<{ upsertedCount: number }>,
 *   createIndex(key: Record<string, number>, options?: Record<string, unknown>): Promise<string>,
 * }} StarterCollection
 * @typedef {{ seed: number, missingQuiz: number, alreadySeeded: number, toInsert: number, inserted: number }} SeedReport
 */

/**
 * @param {{ quizzes: QuizLookup, starters: StarterCollection, apply: boolean, now?: Date, seed?: readonly StarterSeed[] }} input
 * @returns {Promise<SeedReport>}
 */
export async function seedStarterQuizzes({
  quizzes,
  starters,
  apply,
  now = new Date(),
  seed = STARTER_QUIZ_SEED,
}) {
  const report = { seed: seed.length, missingQuiz: 0, alreadySeeded: 0, toInsert: 0, inserted: 0 };
  if (apply) {
    // Same keys as the StarterQuiz model; createIndex is a no-op when present.
    await starters.createIndex({ quiz: 1 }, { unique: true });
    await starters.createIndex({ order: 1 });
  }

  for (const entry of seed) {
    const quiz = await quizzes.findOne({ slug: entry.slug }, { projection: { _id: 1 } });
    if (!quiz) {
      report.missingQuiz += 1;
      continue;
    }
    const existing = await starters.findOne({ quiz: quiz._id }, { projection: { _id: 1 } });
    if (existing) {
      report.alreadySeeded += 1;
      continue;
    }
    report.toInsert += 1;
    if (!apply) continue;
    const result = await starters.updateOne(
      { quiz: quiz._id },
      {
        $setOnInsert: {
          quiz: quiz._id,
          locale: entry.locale,
          order: entry.order,
          createdBy: null,
          updatedBy: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    report.inserted += result.upsertedCount;
  }
  return report;
}

async function main() {
  const { apply, 'dry-run': dryRun } = readCliOptions({
    apply: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  });
  if (apply && dryRun) {
    process.stderr.write('Pass either --apply or --dry-run, not both.\n');
    process.exit(2);
  }
  nextEnv.loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    process.stderr.write('MONGODB_URI is not set.\n');
    process.exit(2);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const db = client.db();
    const report = await seedStarterQuizzes({
      quizzes: db.collection('quizzes'),
      starters: db.collection(STARTER_QUIZ_COLLECTION),
      apply,
    });
    const total = await db.collection(STARTER_QUIZ_COLLECTION).countDocuments({});
    process.stdout.write(
      `${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...report, starterRows: total })}\n`,
    );
    if (report.missingQuiz > 0) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
