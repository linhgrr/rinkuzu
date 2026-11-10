/**
 * RIN-1515: give indexable quizzes created before RIN-623 a readable slug.
 * Their stored slug dropped every Vietnamese letter ("ktpm-chng-7-p1-244002"
 * for "KTPM Chương 7 P1"); the new slug is `slugifyText(title)` plus the
 * existing 6-digit suffix, and the old one becomes a `slugAliases` entry that
 * the quiz page 301s from (RIN-624).
 *
 * Production MongoDB is reached only from the API container, which has Python
 * and no Node, so this file only plans. The tested plan is JSON that
 * `scripts/database/reslug-legacy-quizzes.py` reads and applies:
 *
 *   node scripts/reslug-legacy-quizzes.mjs --export=<export.json>          # forward plan
 *   node scripts/reslug-legacy-quizzes.mjs --revert-backup=<backup.json>   # revert plan
 *
 * `export.json` is what the Python script prints in `export` mode:
 * `{ candidates: [{ _id, title, slug }], takenSlugs: [...] }`, where the
 * candidates are the quizzes the production sitemap lists (the sitemap
 * applies `isQuizIndexable`) and `takenSlugs` holds every slug and alias of
 * every quiz, so a collision with any quiz is refused.
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { readCliOptions } from './cli-options.shared.mjs';

/**
 * The quiz slug rule itself (`generateSlug` uses it), loaded through Node's type
 * stripping; slug.ts has no imports, so it runs as is.
 *
 * @type {{ slugifyText(text: string): string }}
 */
const { slugifyText } = await import(new URL('../src/lib/slug.ts', import.meta.url).href);

/** `generateSlug` ends a slug with the last 6 digits of `Date.now()`; the new slug keeps them. */
const SLUG_SUFFIX = /-(\d{6})$/;

/**
 * @typedef {{ _id: string, title: string, slug: string }} ReslugCandidate
 * @typedef {{ _id: string, from: string, to: string }} ReslugRename
 * @typedef {{
 *   _id: string,
 *   slug: string,
 *   reason: 'empty-title' | 'collision',
 * }} ReslugSkip
 * @typedef {{ renames: ReslugRename[], skipped: ReslugSkip[] }} ReslugPlan
 * @typedef {{
 *   _id: string,
 *   slug: string,
 *   newSlug: string,
 *   slugAliases?: string[] | null,
 * }} ReslugBackupQuiz
 * @typedef {{ _id: string, from: string, to: string, slugAliases: string[] | null }} RevertStep
 */

/**
 * @param {{ candidates: readonly ReslugCandidate[], takenSlugs: readonly string[] }} input
 * @returns {ReslugPlan}
 */
export function planLegacyReslugs({ candidates, takenSlugs }) {
  const taken = new Set(takenSlugs);
  /** @type {ReslugRename[]} */
  const renames = [];
  /** @type {ReslugSkip[]} */
  const skipped = [];
  for (const quiz of candidates) {
    // A few early quizzes have no suffix (`nht-ngnh-final`); they keep none.
    const suffix = SLUG_SUFFIX.exec(quiz.slug)?.[0] ?? '';
    const base = slugifyText(quiz.title);
    if (!base) {
      skipped.push({ _id: quiz._id, slug: quiz.slug, reason: 'empty-title' });
      continue;
    }
    const to = `${base}${suffix}`;
    // Also re-slugs a quiz whose title was edited later (`sss` for "Toán lớp 4"):
    // the stored base no longer says what the quiz is either.
    if (to === quiz.slug) continue;
    if (taken.has(to)) {
      skipped.push({ _id: quiz._id, slug: quiz.slug, reason: 'collision' });
      continue;
    }
    // Two candidates could compute the same slug; the first one wins.
    taken.add(to);
    renames.push({ _id: quiz._id, from: quiz.slug, to });
  }
  return { renames, skipped };
}

/**
 * The exact inverse of an applied plan: every quiz goes back to the slug and
 * aliases the backup recorded (`null` = the field was absent).
 *
 * @param {{ quizzes: readonly ReslugBackupQuiz[] }} backup
 * @returns {RevertStep[]}
 */
export function planRevertFromBackup({ quizzes }) {
  return quizzes.map((quiz) => ({
    _id: quiz._id,
    from: quiz.newSlug,
    to: quiz.slug,
    slugAliases: quiz.slugAliases ? [...quiz.slugAliases] : null,
  }));
}

/** @param {string} file */
async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const options = readCliOptions({
    export: { type: 'string' },
    'revert-backup': { type: 'string' },
  });
  if (options.export) {
    const plan = planLegacyReslugs(await readJson(String(options.export)));
    console.log(JSON.stringify({ mode: 'forward', ...plan }, null, 2));
    return;
  }
  if (options['revert-backup']) {
    const steps = planRevertFromBackup(await readJson(String(options['revert-backup'])));
    console.log(JSON.stringify({ mode: 'revert', steps }, null, 2));
    return;
  }
  throw new Error('pass --export=<file> or --revert-backup=<file>');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
