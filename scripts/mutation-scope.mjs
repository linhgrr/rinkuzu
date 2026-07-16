import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isTypeOnlySource } from './check-coverage-gates.mjs';

export const CRITICAL_MUTATION_PATTERNS = [
  'src/app/api/**/route.ts',
  'src/lib/auth/**/*.ts',
  'src/lib/api/auth.ts',
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
  /^src\/lib\/auth\/.+\.ts$/,
  /^src\/lib\/api\/auth\.ts$/,
  /^src\/lib\/entitlements\/.+\.ts$/,
  /^src\/lib\/integrations\/payos\.ts$/,
  /^src\/models\/.+\.ts$/,
  /^src\/repositories\/.+\.ts$/,
  /^src\/services\/(?:auth|admin|payment|quiz|subscription)\/.+\.ts$/,
  /^src\/features\/(?:admin|adaptive|quiz)\/.+\.ts$/,
  /^src\/lib\/(?:adaptive|adaptive-learning)\/.+\.ts$/,
];

const SAFE_SOURCE_PATH = /^[A-Za-z0-9_./-]+$/;
const TEST_SOURCE_PATH = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

export function normalizeMutationPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
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
