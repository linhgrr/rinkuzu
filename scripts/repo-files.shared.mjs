/**
 * One way for the guards to list repository files.
 *
 * Eleven scripts each carried their own recursive `walk()` over readdirSync,
 * and they had drifted: some skipped node_modules and .next, some did not,
 * some filtered extensions inside the walk and some after it. None of them
 * sorted, so a guard's output order depended on the filesystem. Twelve also
 * repeated `path.relative(root, p).split(path.sep).join('/')` to turn a
 * platform path back into a repository path.
 *
 * Node 22 ships `fs.globSync`, so none of that needs to be hand-written. Two
 * details it does not handle are handled here, because every caller needs
 * them: results come back with the platform separator, and they come back
 * unsorted.
 */
import { existsSync, globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where this script lives, for callers that need the checkout itself. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The tree being inspected, which is not always this checkout.
 *
 * Every guard resolved its roots from `process.cwd()`, and several of their
 * tests depend on that: they build a fixture project in a temp directory and
 * spawn the guard with that as its cwd. Defaulting to `repoRoot` instead made
 * those guards scan the real repository and pass a test that expected a
 * failure. The default has to stay the working directory.
 */
function defaultCwd() {
  return process.cwd();
}

/**
 * Directories no guard has ever wanted to read: dependencies, build output and
 * generated caches. Kept in one place so a new guard cannot forget one.
 */
const ALWAYS_EXCLUDED = [
  '**/node_modules/**',
  '**/.next/**',
  '**/.git/**',
  '**/.gitnexus/**',
  '**/coverage/**',
  '**/dist/**',
  '**/build/**',
  '**/playwright-report/**',
  '**/test-results/**',
];

/**
 * A path as the repository names it: relative to the root, forward slashes on
 * every platform. This is what belongs in a guard's output, so the same
 * violation reads the same way on Windows and in CI.
 *
 * @param {string} filePath absolute, or relative to the repository root
 * @param {string} [root]
 * @returns {string}
 */
export function toRepoPath(filePath, root = defaultCwd()) {
  return path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/');
}

/**
 * Absolute paths of the files matching one or more glob patterns, sorted by
 * repository path so a guard's output is stable.
 *
 * @param {string | string[]} patterns glob(s) relative to `cwd`
 * @param {{ cwd?: string, exclude?: string[] }} [options]
 * @returns {string[]}
 */
export function listFiles(patterns, options = {}) {
  const { cwd = defaultCwd(), exclude = [] } = options;
  // Guards routinely probe a directory that may not exist yet -- an optional
  // feature folder, a report directory before the first run. Each hand-rolled
  // walker opened with its own existsSync guard; this is that guard, once.
  if (!existsSync(cwd)) return [];
  // withFileTypes, because a pattern like '**/*' matches directories too and
  // every caller here wants something it can read.
  return globSync(patterns, { cwd, exclude: [...ALWAYS_EXCLUDED, ...exclude], withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.resolve(entry.parentPath, entry.name))
    .sort((left, right) => toRepoPath(left).localeCompare(toRepoPath(right)));
}

/**
 * The same list, already expressed as repository paths.
 *
 * @param {string | string[]} patterns
 * @param {{ cwd?: string, exclude?: string[] }} [options]
 * @returns {string[]}
 */
export function listRepoPaths(patterns, options = {}) {
  return listFiles(patterns, options).map((filePath) => toRepoPath(filePath));
}
