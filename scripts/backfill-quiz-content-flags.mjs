/**
 * RIN-1341 backfill: run the RIN-1338 personal-data check over every public
 * quiz saved before the check existed, and store `contentFlags` only.
 *
 *   node scripts/backfill-quiz-content-flags.mjs            # dry run (default)
 *   node scripts/backfill-quiz-content-flags.mjs --dry-run  # same, explicit
 *   node scripts/backfill-quiz-content-flags.mjs --apply    # write
 *
 * It prints counts only (scanned, flagged, cleared, writes, flagged quizzes by
 * kind), never a title, a text or a matched value.
 *
 * - Writes `contentFlags` and nothing else: no content, no visibility, and no
 *   `updatedAt` (the driver does not touch it), so sitemap dates stay true.
 * - Idempotent: a quiz whose stored flags already match the check is skipped,
 *   so a second run writes nothing.
 * - Safe against a concurrent edit: each write is conditional on the quiz's
 *   `updatedAt` being unchanged since the read; an edited quiz was re-checked
 *   by its save (RIN-1338) and is left alone.
 * - An admin clear in force stays in force (`resolveQuizContentFlags`).
 *
 * Reversal: db.quizzes.updateMany({}, { $unset: { contentFlags: 1 } })
 * (drops every flag, including those set on save since RIN-1338).
 */
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { readCliOptions } from './cli-options.shared.mjs';

const { loadEnvConfig } = nextEnv;

const BATCH_SIZE = 500;

/** Only what the check reads, plus what the idempotency and race guards need. */
export const BACKFILL_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  'questions.question': 1,
  'questions.options': 1,
  contentFlags: 1,
  updatedAt: 1,
};

/**
 * @param {unknown} left
 * @param {unknown} right
 */
function sameId(left, right) {
  if (left === undefined || right === undefined) return left === right;
  return String(left) === String(right);
}

/**
 * True when the stored flags already say what the check says; `checkedAt`
 * does not count, so a re-run writes nothing.
 * @param {Record<string, any> | undefined | null} stored
 * @param {{ personalData: boolean, kinds: string[], clearedBy?: unknown }} next
 */
function sameFlags(stored, next) {
  if (!stored) return false;
  const storedKinds = Array.isArray(stored.kinds) ? stored.kinds : [];
  return (
    stored.personalData === next.personalData &&
    storedKinds.length === next.kinds.length &&
    storedKinds.every((kind, index) => kind === next.kinds[index]) &&
    sameId(stored.clearedBy ?? undefined, next.clearedBy)
  );
}

/**
 * Plans one quiz. `resolveFlags` is `resolveQuizContentFlags` from
 * `src/lib/quiz/personal-data.ts`.
 * @param {Record<string, any>} quiz a quiz read with BACKFILL_PROJECTION
 * @param {(quiz: any, previous: any, now: Date) => any} resolveFlags
 * @param {Date} now
 * @returns {{ flags: Record<string, any>, write: boolean }}
 */
function planQuizContentFlags(quiz, resolveFlags, now) {
  const source = {
    title: typeof quiz.title === 'string' ? quiz.title : '',
    ...(typeof quiz.description === 'string' ? { description: quiz.description } : {}),
    questions: (Array.isArray(quiz.questions) ? quiz.questions : []).map((question) => ({
      question: typeof question?.question === 'string' ? question.question : '',
      options: Array.isArray(question?.options)
        ? question.options.filter((option) => typeof option === 'string')
        : [],
    })),
  };
  const stored = quiz.contentFlags ?? undefined;
  const previous =
    stored && stored.clearedBy != null && stored.clearedAt != null
      ? { ...stored, kinds: Array.isArray(stored.kinds) ? stored.kinds : [] }
      : undefined;
  const flags = resolveFlags(source, previous, now);
  return { flags, write: !sameFlags(stored, flags) };
}

/** @returns {{ scanned: number, flagged: number, cleared: number, writes: number, raced: number, byKind: Record<string, number> }} */
function emptyCounts() {
  return { scanned: 0, flagged: 0, cleared: 0, writes: 0, raced: 0, byKind: {} };
}

/**
 * @param {ReturnType<typeof emptyCounts>} counts
 * @param {Record<string, any>} flags
 */
function count(counts, flags) {
  counts.scanned += 1;
  if (flags.personalData) {
    counts.flagged += 1;
    for (const kind of flags.kinds) counts.byKind[kind] = (counts.byKind[kind] ?? 0) + 1;
  } else if (flags.clearedBy !== undefined) {
    counts.cleared += 1;
  }
}

/**
 * Runs the backfill over the public quizzes of `db`.
 * @param {{ collection(name: string): any }} db a `Db`, or a fake with `find` and `bulkWrite`
 * @param {{ apply: boolean, resolveFlags: (quiz: any, previous: any, now: Date) => any, now?: Date }} options
 */
export async function backfillQuizContentFlags(db, { apply, resolveFlags, now = new Date() }) {
  const quizzes = db.collection('quizzes');
  const counts = emptyCounts();
  /** @type {import('mongodb').AnyBulkWriteOperation[]} */
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await quizzes.bulkWrite(batch, { ordered: false });
    counts.writes += result.modifiedCount;
    counts.raced += batch.length - result.matchedCount;
    batch = [];
  };

  const cursor = quizzes.find({ visibility: 'public' }, { projection: BACKFILL_PROJECTION });
  for await (const quiz of cursor) {
    const { flags, write } = planQuizContentFlags(quiz, resolveFlags, now);
    count(counts, flags);
    if (!write) continue;
    if (!apply) {
      counts.writes += 1;
      continue;
    }
    batch.push({
      updateOne: {
        filter: { _id: quiz._id, visibility: 'public', updatedAt: quiz.updatedAt ?? null },
        update: { $set: { contentFlags: flags } },
      },
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return counts;
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const options = readCliOptions({
    apply: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  });
  if (options.apply && options['dry-run']) throw new Error('Pass --apply or --dry-run, not both');

  // Node 22.18+ strips the types of this pure module; one rule for saves and backfill.
  const detector = await import(new URL('../src/lib/quiz/personal-data.ts', import.meta.url).href);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const counts = await backfillQuizContentFlags(client.db(), {
      apply: options.apply,
      resolveFlags: detector.resolveQuizContentFlags,
    });
    process.stdout.write(
      `${JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', ...counts }, null, 2)}\n`,
    );
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
