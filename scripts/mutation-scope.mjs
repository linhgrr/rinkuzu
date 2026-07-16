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
const TYPE_ONLY_SOURCE_PATH = /^src\/repositories\/types\//;

export function normalizeMutationPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isCriticalMutationFile(filePath) {
  const normalized = normalizeMutationPath(filePath);
  return (
    SAFE_SOURCE_PATH.test(normalized) &&
    !TEST_SOURCE_PATH.test(normalized) &&
    !TYPE_ONLY_SOURCE_PATH.test(normalized) &&
    CRITICAL_MUTATION_PATHS.some((pattern) => pattern.test(normalized))
  );
}

export function selectCriticalMutationFiles(filePaths) {
  return [...new Set(filePaths.map(normalizeMutationPath).filter(isCriticalMutationFile))].sort();
}
