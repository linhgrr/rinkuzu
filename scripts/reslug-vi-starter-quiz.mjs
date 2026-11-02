/**
 * RIN-624: move the Vietnamese starter quiz to a transliterated slug, keeping
 * the old slug as an alias that 301s to the new one. One document only.
 *
 *   node scripts/reslug-vi-starter-quiz.mjs                    # dry-run
 *   node scripts/reslug-vi-starter-quiz.mjs --apply            # write
 *   node scripts/reslug-vi-starter-quiz.mjs --revert           # dry-run of the revert
 *   node scripts/reslug-vi-starter-quiz.mjs --revert --apply   # swap back, pull alias
 *
 * Every write backs up `_id`, `title`, `slug` and `slugAliases` to a JSON file
 * in --backup-dir (default ~/rinkuzu-backups, outside the repo) first. Run it
 * only after the alias-redirect code is deployed, so the old URL keeps working.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

import { readCliOptions } from './cli-options.shared.mjs';

export const OLD_SLUG = 'cch-ghi-nh-nhng-g-bn-hc-quiz-khi-ng-7-cu-096007';
/** slugifyText(EXPECTED_TITLE) + the old `-096007` suffix (asserted in the unit test). */
export const NEW_SLUG = 'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007';
export const EXPECTED_TITLE = 'Cách ghi nhớ những gì bạn học (quiz khởi động 7 câu)';

const PROJECTION = { _id: 1, title: 1, slug: 1, slugAliases: 1 };

/**
 * @typedef {{ _id: unknown, title?: string, slug: string, slugAliases?: string[] }} QuizSlugDoc
 * @typedef {{
 *   findOne(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<QuizSlugDoc | null>,
 *   updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ matchedCount: number }>,
 * }} QuizCollection
 * @typedef {{ status: 'ready' | 'already-done' | 'refused', reason?: string, quiz?: QuizSlugDoc }} ReslugPlan
 */

/**
 * @param {QuizCollection} quizzes
 * @param {'forward' | 'revert'} direction
 * @returns {Promise<ReslugPlan>}
 */
export async function planReslug(quizzes, direction) {
  const [from, to] = direction === 'forward' ? [OLD_SLUG, NEW_SLUG] : [NEW_SLUG, OLD_SLUG];
  const quiz = await quizzes.findOne({ slug: from }, { projection: PROJECTION });
  if (!quiz) {
    const done = await quizzes.findOne({ slug: to }, { projection: PROJECTION });
    if (done && (direction === 'revert' || done.slugAliases?.includes(OLD_SLUG))) {
      return { status: 'already-done', quiz: done };
    }
    return { status: 'refused', reason: `no quiz has slug ${from}` };
  }
  if (quiz.title !== EXPECTED_TITLE) {
    return { status: 'refused', reason: `unexpected title ${JSON.stringify(quiz.title)}`, quiz };
  }
  if (direction === 'revert' && !quiz.slugAliases?.includes(OLD_SLUG)) {
    return { status: 'refused', reason: `quiz does not list ${OLD_SLUG} as an alias`, quiz };
  }
  const conflict = await quizzes.findOne(
    { _id: { $ne: quiz._id }, $or: [{ slug: to }, { slugAliases: to }] },
    { projection: { _id: 1 } },
  );
  if (conflict) {
    return { status: 'refused', reason: `slug ${to} already belongs to another quiz`, quiz };
  }
  return { status: 'ready', quiz };
}

/**
 * @param {QuizCollection} quizzes
 * @param {QuizSlugDoc} quiz
 * @param {'forward' | 'revert'} direction
 */
export async function applyReslug(quizzes, quiz, direction) {
  const update =
    direction === 'forward'
      ? { $set: { slug: NEW_SLUG }, $addToSet: { slugAliases: OLD_SLUG } }
      : { $set: { slug: OLD_SLUG }, $pull: { slugAliases: OLD_SLUG } };
  const from = direction === 'forward' ? OLD_SLUG : NEW_SLUG;
  const result = await quizzes.updateOne({ _id: quiz._id, slug: from }, update);
  if (result.matchedCount !== 1) throw new Error(`expected 1 match, got ${result.matchedCount}`);
  if (direction === 'revert') {
    // Leave the document as it was before the forward run: no empty alias array.
    await quizzes.updateOne(
      { _id: quiz._id, slugAliases: { $size: 0 } },
      { $unset: { slugAliases: '' } },
    );
  }
}

/** @param {QuizSlugDoc} quiz @param {string} backupDir */
async function writeBackup(quiz, backupDir) {
  await mkdir(backupDir, { recursive: true });
  const file = path.join(
    backupDir,
    `rin-624-quiz-${String(quiz._id)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(file, `${JSON.stringify({ ...quiz, _id: String(quiz._id) }, null, 2)}\n`);
  return file;
}

async function main() {
  const options = readCliOptions({
    apply: { type: 'boolean', default: false },
    revert: { type: 'boolean', default: false },
    'backup-dir': { type: 'string', default: path.join(os.homedir(), 'rinkuzu-backups') },
  });
  nextEnv.loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const direction = options.revert ? 'revert' : 'forward';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    /** @type {QuizCollection} */
    const quizzes = /** @type {any} */ (client.db().collection('quizzes'));
    const plan = await planReslug(quizzes, direction);
    const summary = {
      direction,
      mode: options.apply ? 'apply' : 'dry-run',
      status: plan.status,
      reason: plan.reason,
      quiz: plan.quiz && { ...plan.quiz, _id: String(plan.quiz._id) },
    };
    console.log(JSON.stringify(summary, null, 2));
    if (plan.status === 'refused') process.exitCode = 1;
    if (plan.status !== 'ready' || !plan.quiz || !options.apply) return;

    const backup = await writeBackup(plan.quiz, String(options['backup-dir']));
    console.log(`backup written: ${backup}`);
    await applyReslug(quizzes, plan.quiz, direction);
    const after = await quizzes.findOne({ _id: plan.quiz._id }, { projection: PROJECTION });
    console.log(JSON.stringify({ after: after && { ...after, _id: String(after._id) } }, null, 2));
  } finally {
    await client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
