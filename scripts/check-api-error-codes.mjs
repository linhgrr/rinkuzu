import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const workspaceRoot = path.resolve(frontendRoot, '..');
const frontendContractPath = path.join(frontendRoot, 'contracts', 'api-error-codes.json');
const backendContractPath = path.join(
  workspaceRoot,
  'rinkuzu-ai-api',
  'contracts',
  'api-error-codes.json',
);
const backendApiRoot = path.join(workspaceRoot, 'rinkuzu-ai-api', 'api');

const frontendContract = JSON.parse(readFileSync(frontendContractPath, 'utf8'));
const hasBackendCheckout = existsSync(backendContractPath) && existsSync(backendApiRoot);
const backendContract = hasBackendCheckout
  ? JSON.parse(readFileSync(backendContractPath, 'utf8'))
  : null;
const allowedCodes = new Set(Object.keys(frontendContract.defaultMessagesByCode));

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.venv',
  '.worktrees',
  'coverage',
  'dist',
  'build',
  '__pycache__',
  'node_modules',
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function collectMatches({ baseDir, includeFile, regex }) {
  const results = new Map();

  for (const filePath of walk(baseDir)) {
    if (!includeFile(filePath)) continue;
    const repoPath = path.relative(baseDir, filePath).split(path.sep).join('/');
    const source = readFileSync(filePath, 'utf8');

    for (const match of source.matchAll(regex)) {
      const code = match[1];
      if (!code) continue;
      const existing = results.get(code) ?? [];
      existing.push(repoPath);
      results.set(code, existing);
    }
  }

  return results;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function missingCodeEntries(label, entries) {
  return [...entries.entries()]
    .filter(([code]) => !allowedCodes.has(code))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, files]) => ({
      code,
      files: uniqueSorted(files).map((file) => `${label}:${file}`),
    }));
}

if (backendContract && JSON.stringify(frontendContract) !== JSON.stringify(backendContract)) {
  console.error('API error code contract drift detected between frontend and backend.');
  console.error(`- frontend: ${frontendContractPath}`);
  console.error(`- backend:  ${backendContractPath}`);
  process.exit(1);
}

for (const [status, code] of Object.entries(frontendContract.httpStatusToCode)) {
  if (!allowedCodes.has(code)) {
    console.error(
      `API error code contract is invalid: httpStatusToCode[${status}] -> ${code} is missing from defaultMessagesByCode.`,
    );
    process.exit(1);
  }
}

for (const status of Object.keys(frontendContract.httpStatusToMessage)) {
  if (!(status in frontendContract.httpStatusToCode)) {
    console.error(
      `API error code contract is invalid: httpStatusToMessage[${status}] has no matching httpStatusToCode entry.`,
    );
    process.exit(1);
  }
}

const frontendCodeUsages = collectMatches({
  baseDir: path.join(frontendRoot, 'src'),
  includeFile: (filePath) => {
    if (!/\.(ts|tsx|js|mjs)$/.test(filePath)) return false;
    return !/(\.test|\.spec)\.(ts|tsx|js|mjs)$/.test(filePath);
  },
  regex: /apiErr\(\s*['"]([a-z0-9_]+)['"]/g,
});

const backendCodeUsages = hasBackendCheckout
  ? collectMatches({
      baseDir: backendApiRoot,
      includeFile: (filePath) => filePath.endsWith('.py'),
      regex: /(?:^|[^\w])(?:code|error_code)\s*=\s*['"]([a-z0-9_]+)['"]/gm,
    })
  : new Map();

const missingFrontendCodes = missingCodeEntries('frontend', frontendCodeUsages);
const missingBackendCodes = missingCodeEntries('backend', backendCodeUsages);

if (missingFrontendCodes.length > 0 || missingBackendCodes.length > 0) {
  console.error('API error code contract is missing codes used by the application.');
  for (const entry of [...missingFrontendCodes, ...missingBackendCodes]) {
    console.error(`- ${entry.code}`);
    for (const file of entry.files) {
      console.error(`  - ${file}`);
    }
  }
  process.exit(1);
}

if (!hasBackendCheckout) {
  // Half of this gate is the cross-repo drift check, and it only runs beside a
  // checkout of rinkuzu-ai-api. Reporting "passed" for a run that skipped it
  // leaves a partial result indistinguishable from a whole one, so it does not.
  //
  // Set REQUIRE_BACKEND_CONTRACT=1 wherever that checkout is guaranteed: that is
  // what turns the skip into a failure instead of a notice.
  if (process.env['REQUIRE_BACKEND_CONTRACT'] === '1') {
    console.error(
      'API error code contract check FAILED: REQUIRE_BACKEND_CONTRACT=1 but no rinkuzu-ai-api checkout is present.',
    );
    console.error(`- expected contract: ${backendContractPath}`);
    console.error(`- expected sources:  ${backendApiRoot}`);
    process.exit(1);
  }
  process.stdout.write(
    'API error code contract check PARTIAL: frontend half passed; cross-repo drift check did NOT run (no rinkuzu-ai-api checkout).\n',
  );
  process.exit(0);
}

process.stdout.write('API error code contract check passed.\n');
