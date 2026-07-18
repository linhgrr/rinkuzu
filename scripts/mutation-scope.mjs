import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isTypeOnlySource } from './check-coverage-gates.mjs';

export const CRITICAL_MUTATION_PATTERNS = [
  'src/app/api/**/route.ts',
  // NextAuth runtime entrypoints (missed by src/lib/auth/**).
  'src/auth.ts',
  'src/auth.config.ts',
  'src/lib/auth/**/*.ts',
  'src/lib/api/auth.ts',
  // Password hashing / verification and secure token minting (runtime security).
  'src/lib/password.ts',
  'src/lib/auth-tokens.ts',
  // Trusted URL / navigation guards and other security helpers.
  'src/lib/security/**/*.ts',
  'src/lib/entitlements/**/*.ts',
  'src/lib/integrations/payos.ts',
  'src/models/**/*.ts',
  'src/repositories/**/*.ts',
  'src/services/{auth,admin,payment,quiz,subscription}/**/*.ts',
  'src/features/{admin,adaptive,quiz}/**/*.ts',
  'src/lib/{adaptive,adaptive-learning}/**/*.ts',
];

const CRITICAL_MUTATION_PATHS = [
  /^src\/app\/api\/.+\/route\.ts$/,
  /^src\/auth\.ts$/,
  /^src\/auth\.config\.ts$/,
  /^src\/lib\/auth\/.+\.ts$/,
  /^src\/lib\/api\/auth\.ts$/,
  /^src\/lib\/password\.ts$/,
  /^src\/lib\/auth-tokens\.ts$/,
  /^src\/lib\/security\/.+\.ts$/,
  /^src\/lib\/entitlements\/.+\.ts$/,
  /^src\/lib\/integrations\/payos\.ts$/,
  /^src\/models\/.+\.ts$/,
  /^src\/repositories\/.+\.ts$/,
  /^src\/services\/(?:auth|admin|payment|quiz|subscription)\/.+\.ts$/,
  /^src\/features\/(?:admin|adaptive|quiz)\/.+\.ts$/,
  /^src\/lib\/(?:adaptive|adaptive-learning)\/.+\.ts$/,
];

// Allow literal [ ] for Next.js dynamic route segments (e.g. [id], [...nextauth]).
// Still rejects whitespace, shell metacharacters, backslashes, and other unsafe chars.
const SAFE_SOURCE_PATH = /^[A-Za-z0-9_./[\]-]+$/;
const TEST_SOURCE_PATH = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

export function normalizeMutationPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

// Stryker FileMatcher runs normalizeFileName (\\ → /) on mutate patterns before
// minimatch. Backslash escapes like \[id\] are destroyed (become /[id/). Use a
// backslash-free minimatch character-class escape instead: literal [ → [[]
// (and leave ] as a literal closer). Critical scope paths only allow
// [A-Za-z0-9_./[\]-], so [ is the only glob metachar that needs escaping.
// Keep scope.files as unescaped normalized repo paths for evidence binding.
const STRYKER_LITERAL_OPEN_BRACKET = '[[]';

/**
 * Escape a repo-relative source path for Stryker `--mutate` (minimatch).
 * Produces patterns that survive Stryker's normalizeFileName. Does not alter
 * scope.files evidence; use only at the mutate command handoff.
 *
 * @param {string} filePath
 * @returns {string}
 */
export function escapeStrykerMutatePattern(filePath) {
  return normalizeMutationPath(filePath).replaceAll('[', STRYKER_LITERAL_OPEN_BRACKET);
}

/**
 * Map literal scope files to Stryker mutate patterns (escaped globs).
 *
 * @param {string[]} filePaths
 * @returns {string[]}
 */
export function toStrykerMutatePatterns(filePaths) {
  return filePaths.map((filePath) => escapeStrykerMutatePattern(filePath));
}

/**
 * Comma-separated escaped mutate patterns for GITHUB_OUTPUT `files` / `--mutate`.
 * Callers must keep scope.json `files` as the original literal paths.
 *
 * @param {string[]} filePaths
 * @returns {string}
 */
export function formatStrykerMutateOutput(filePaths) {
  return toStrykerMutatePatterns(filePaths).join(',');
}

/**
 * Recover a literal repo path from a Stryker mutate pattern that may contain
 * FileMatcher-safe `[` → `[[]` escapes. Used to relate report.config.mutate
 * back to scope.files without weakening exact binding.
 *
 * @param {string} pattern
 * @returns {string}
 */
export function literalPathFromStrykerMutatePattern(pattern) {
  return normalizeMutationPath(pattern.replaceAll(STRYKER_LITERAL_OPEN_BRACKET, '['));
}

/**
 * True when report mutate input is exactly the escaped form of the changed scope files.
 * Compares sorted unique sets so evidence binding stays fail-closed.
 *
 * @param {string[] | undefined} reportMutate
 * @param {string[] | undefined} scopeFiles
 * @returns {boolean}
 */
export function strykerMutateInputMatchesScopeFiles(reportMutate, scopeFiles) {
  const expectedLiterals = [
    ...new Set((scopeFiles ?? []).map((file) => normalizeMutationPath(file))),
  ].sort();
  const expectedPatterns = expectedLiterals.map((file) => escapeStrykerMutatePattern(file)).sort();
  const actualPatterns = [...(reportMutate ?? []).map((pattern) => String(pattern))].sort();
  const actualLiterals = [
    ...new Set(actualPatterns.map((pattern) => literalPathFromStrykerMutatePattern(pattern))),
  ].sort();

  return (
    actualPatterns.length === expectedPatterns.length &&
    actualPatterns.every((value, index) => value === expectedPatterns[index]) &&
    actualLiterals.length === expectedLiterals.length &&
    actualLiterals.every((value, index) => value === expectedLiterals[index])
  );
}

/**
 * Fail-closed type-only detector for mutation scope.
 * Returns true only when the source is proven type-only (no runtime
 * statements/imports/exports). On missing source or I/O failure, returns false
 * so runtime logic is retained in the mutation scope.
 *
 * @param {string} filePath
 * @param {{ root?: string, sourceText?: string }} [options]
 */
export function isTypeOnlyMutationFile(filePath, options = {}) {
  const normalized = normalizeMutationPath(filePath);
  let sourceText = options.sourceText;
  if (sourceText === undefined) {
    const absolute = path.resolve(options.root ?? process.cwd(), normalized);
    if (!existsSync(absolute)) return false;
    try {
      sourceText = readFileSync(absolute, 'utf8');
    } catch {
      return false;
    }
  }
  try {
    return isTypeOnlySource(sourceText, normalized);
  } catch {
    return false;
  }
}

export function isCriticalMutationFile(filePath, options = {}) {
  const normalized = normalizeMutationPath(filePath);
  return (
    SAFE_SOURCE_PATH.test(normalized) &&
    !TEST_SOURCE_PATH.test(normalized) &&
    CRITICAL_MUTATION_PATHS.some((pattern) => pattern.test(normalized)) &&
    !isTypeOnlyMutationFile(normalized, options)
  );
}

export function selectCriticalMutationFiles(filePaths, options = {}) {
  return [
    ...new Set(
      filePaths
        .map(normalizeMutationPath)
        .filter((filePath) => isCriticalMutationFile(filePath, options)),
    ),
  ].sort();
}
