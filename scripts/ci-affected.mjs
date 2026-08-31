import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Decides which expensive CI stages a change can possibly affect.
 *
 * The rule this encodes is narrow on purpose: a change confined to prose cannot
 * alter a bundle, a database index or a browser flow, so the jobs that build,
 * boot Mongo or drive a browser have nothing to tell us about it. Anything
 * wider than prose runs everything.
 *
 * It fails closed in every direction. An unresolvable base, a git failure, an
 * empty diff, an unrecognised event — each answers "run everything", because a
 * stage skipped on a bad premise is a stage that reported success without
 * looking, and that is worse than a slow pipeline.
 */

/**
 * Paths that cannot reach a bundle, a schema or a browser.
 *
 * Deliberately excludes `.github/workflows` and `.github/actions`: a change
 * there decides how the stages themselves run, so it is the last thing that may
 * switch them off.
 */
const PROSE_ONLY = Object.freeze([
  /^docs\/.*$/,
  /^\.claude\/.*$/,
  /^\.agents\/.*$/,
  /^\.github\/ISSUE_TEMPLATE\/.*$/,
  /^\.github\/PULL_REQUEST_TEMPLATE(\/.*)?$/,
  /^[^/]+\.md$/,
  /^LICENSE$/,
]);

/** @param {string} file */
export const isProse = (file) => PROSE_ONLY.some((pattern) => pattern.test(file));

/**
 * @param {readonly string[] | null} files
 * @returns {{ heavy: boolean, reason: string, sample: string[] }}
 */
export function classifyChangedFiles(files) {
  if (files === null) {
    return { heavy: true, reason: 'no resolvable diff; running every stage', sample: [] };
  }
  if (files.length === 0) {
    return { heavy: true, reason: 'empty diff; running every stage', sample: [] };
  }
  const nonProse = files.filter((file) => !isProse(file));
  if (nonProse.length > 0) {
    return {
      heavy: true,
      reason: `${nonProse.length} of ${files.length} changed path(s) are not prose`,
      sample: nonProse.slice(0, 5),
    };
  }
  return {
    heavy: false,
    reason: `all ${files.length} changed path(s) are prose`,
    sample: files.slice(0, 5),
  };
}

/** @param {NodeJS.ProcessEnv} env @returns {string[] | null} */
export function readChangedFiles(env = process.env) {
  const eventName = env['GITHUB_EVENT_NAME'] ?? '';
  const base =
    eventName === 'pull_request'
      ? env['PR_BASE_SHA']
      : eventName === 'push'
        ? env['PUSH_BEFORE_SHA']
        : undefined;

  if (!base || /^0{40}$/.test(base)) return null;

  try {
    execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { stdio: 'ignore' });
    const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const decision = classifyChangedFiles(readChangedFiles());
  const line = `heavy=${decision.heavy ? 'true' : 'false'}`;
  if (process.env['GITHUB_OUTPUT']) {
    fs.appendFileSync(process.env['GITHUB_OUTPUT'], `${line}\n`);
  }
  process.stdout.write(`${line} (${decision.reason})\n`);
  if (decision.sample.length > 0) {
    process.stdout.write(`  e.g. ${decision.sample.join(', ')}\n`);
  }
}
