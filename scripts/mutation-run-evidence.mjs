import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  CRITICAL_MUTATION_PATTERNS,
  isCriticalMutationFile,
  normalizeMutationPath,
  selectCriticalMutationFiles,
  strykerMutateInputMatchesScopeFiles,
  toStrykerMutatePatterns,
} from './mutation-scope.mjs';

const GATE_RUN_META_SCHEMA_VERSION = 1;
const GATE_RUN_META_RELATIVE = 'reports/mutation/gate-run-meta.json';
export const MUTATION_SCOPE_RELATIVE = 'reports/mutation/scope.json';
export const MUTATION_REPORT_RELATIVE = 'reports/mutation/mutation.json';
export const MUTATION_RERUN_MESSAGE =
  'Rerun `npm run mutation:gate` to regenerate authoritative mutation evidence.';
export const CHANGED_MUTATION_BREAK_THRESHOLD = 80;

/** Repository contract: expected Node and Stryker versions. Not env-steerable. */
export const EXPECTED_NODE_VERSION = '22.23.1';
export const EXPECTED_STRYKER_VERSION = '9.6.1';

export const MUTATION_FINGERPRINT_CONFIG_PATHS = [
  '.nvmrc',
  'package-lock.json',
  'stryker.config.mjs',
  'tsconfig.json',
  'vitest.config.ts',
  'tests/setup/vitest.setup.ts',
  'scripts/check-coverage-gates.mjs',
  'scripts/mutation-scope.mjs',
];

const EMPTY_SHA256 = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
const R = (msg) => `${msg} ${MUTATION_RERUN_MESSAGE}`;
const UNIT_TEST_PATH =
  /^(?:src|tests)\/(?:(?!e2e\/|integration\/|quality\/).)+\.(?:test|spec)\.[cm]?[jt]sx?$/;
const LEGACY_QUALITY_TEST_PATHS = new Set(['tests/performance-budget.test.ts']);
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[-A-Za-z0-9_./()[\]]+$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const GIT_SHA40 = /^[0-9a-f]{40}$/;
const VALID_MUTANT_STATUSES = new Set(['Killed', 'Survived', 'NoCoverage', 'Timeout']);
const DETECTED_MUTANT_STATUSES = new Set(['Killed', 'Timeout']);
const FINGERPRINT_CONFIG_SET = new Set(MUTATION_FINGERPRINT_CONFIG_PATHS);
const STRYKER_CORE_PACKAGE_RELATIVE = 'node_modules/@stryker-mutator/core/package.json';
const GATE_SCRIPT_PATHS = new Set([
  'scripts/check-mutation-report.mjs',
  'scripts/run-mutation-gate.mjs',
  'scripts/mutation-run-evidence.mjs',
]);
const POLICY_ONLY_PATHS = new Set([
  'quality/mutation-baseline.json',
  'quality/mutation-waivers.json',
]);

function compareCodeUnitStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortCodeUnitStrings(values) {
  return [...values].sort(compareCodeUnitStrings);
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(absolutePath) {
  return sha256Buffer(readFileSync(absolutePath));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((e) => stableStringify(e)).join(',')}]`;
  const keys = sortCodeUnitStrings(Object.keys(value));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function resolveSafeRepoPath(root, relativePath) {
  const normalized = normalizeMutationPath(relativePath);
  if (!normalized || path.isAbsolute(relativePath) || path.isAbsolute(normalized)) {
    return { ok: false, error: `${relativePath}: absolute paths are not allowed in manifests.` };
  }
  if (normalized.includes('\0') || !SAFE_RELATIVE_PATH.test(normalized)) {
    return {
      ok: false,
      error: `${relativePath}: path is unsafe (traversal, shell metacharacters, or invalid characters).`,
    };
  }
  const absolutePath = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (
    absolutePath !== rootResolved &&
    !absolutePath.startsWith(rootResolved + path.sep) &&
    !absolutePath.startsWith(rootResolved + '/')
  ) {
    return { ok: false, error: `${relativePath}: path escapes the repository root.` };
  }
  if (existsSync(absolutePath)) {
    try {
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        return { ok: false, error: `${normalized}: symlinks are not allowed in manifests.` };
      }
      if (!stat.isFile()) {
        return { ok: false, error: `${normalized}: manifest entries must be regular files.` };
      }
    } catch (error) {
      return {
        ok: false,
        error: `${normalized}: unreadable (${error instanceof Error ? error.message : error}).`,
      };
    }
  }
  return { ok: true, absolutePath, normalized };
}

export function buildRelevantManifest(root, entries) {
  /** @type {Map<string, { path: string, sha256: string, state: 'present' | 'deleted' }>} */
  const byPath = new Map();
  for (const entry of entries) {
    const relative = typeof entry === 'string' ? entry : entry.path;
    const requestedState = typeof entry === 'string' ? undefined : entry.state;
    const resolved = resolveSafeRepoPath(root, relative);
    if (resolved.ok === false) throw new Error(resolved.error);
    const { absolutePath, normalized } = resolved;
    const exists = existsSync(absolutePath);
    const state =
      requestedState === 'deleted' || (!exists && requestedState !== 'present')
        ? exists
          ? 'present'
          : 'deleted'
        : 'present';
    if (state === 'deleted') {
      if (exists) throw new Error(`${normalized}: expected deleted state but file exists.`);
      byPath.set(normalized, { path: normalized, sha256: EMPTY_SHA256, state: 'deleted' });
      continue;
    }
    if (!exists) throw new Error(`${normalized}: required manifest file is missing.`);
    try {
      byPath.set(normalized, {
        path: normalized,
        sha256: sha256File(absolutePath),
        state: 'present',
      });
    } catch (error) {
      throw new Error(
        `${normalized}: unreadable (${error instanceof Error ? error.message : error}).`,
      );
    }
  }
  const sorted = [...byPath.values()].sort((a, b) => compareCodeUnitStrings(a.path, b.path));
  return {
    entries: sorted,
    sha256: sha256Buffer(stableStringify(sorted)),
    entryCount: sorted.length,
  };
}

export function isUnitTestPath(filePath) {
  const normalized = normalizeMutationPath(filePath);
  if (LEGACY_QUALITY_TEST_PATHS.has(normalized)) return false;
  if (!UNIT_TEST_PATH.test(normalized)) return false;
  if (normalized.startsWith('perf/') || normalized.startsWith('public/')) return false;
  if (normalized.startsWith('messages/')) return false;
  if (normalized.startsWith('reports/') || normalized.startsWith('src/generated/')) return false;
  return true;
}

/**
 * Mutation-relevant test support files fingerprinted alongside unit tests:
 * tests/helpers and tests/setup trees, plus src __tests__ / __mocks__ trees.
 * e2e/integration/quality stay excluded unless listed as explicit config.
 */
export function isMutationTestSupportPath(filePath) {
  const normalized = normalizeMutationPath(filePath);
  if (normalized.startsWith('tests/helpers/') || normalized.startsWith('tests/setup/')) {
    return true;
  }
  if (!normalized.startsWith('src/')) return false;
  if (normalized.includes('/__tests__/') || normalized.includes('/__mocks__/')) {
    return true;
  }
  return false;
}

/** Unit tests plus mutation test-support paths included in evidence fingerprints. */
export function isMutationFingerprintTestPath(filePath) {
  return isUnitTestPath(filePath) || isMutationTestSupportPath(filePath);
}

function isQualityTestPath(filePath) {
  const n = normalizeMutationPath(filePath);
  return (
    LEGACY_QUALITY_TEST_PATHS.has(n) ||
    (n.startsWith('tests/quality/') && /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(n))
  );
}

/**
 * Read the installed Stryker core version from local node_modules.
 * Fail closed on missing, unreadable, or invalid package metadata.
 *
 * @param {string} [root]
 * @returns {string}
 */
function readInstalledStrykerVersion(root = process.cwd()) {
  const packagePath = path.join(root, STRYKER_CORE_PACKAGE_RELATIVE);
  if (!existsSync(packagePath)) {
    throw new Error(
      `Local @stryker-mutator/core package.json missing at ${packagePath}. Install @stryker-mutator/core@${EXPECTED_STRYKER_VERSION} (npm ci).`,
    );
  }
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
      throw new Error('Local @stryker-mutator/core package.json has no version field.');
    }
    return packageJson.version;
  } catch (error) {
    if (error instanceof Error && error.message.includes('@stryker-mutator/core')) {
      throw error;
    }
    throw new Error(
      `Local @stryker-mutator/core package.json unreadable (${
        error instanceof Error ? error.message : error
      }).`,
    );
  }
}

/**
 * Record actual Node (process) and installed Stryker versions.
 * Does not record npm. Does not accept env pin overrides.
 *
 * @param {string} [root]
 * @returns {{ node: string, stryker: string }}
 */
export function buildToolchainRecord(root = process.cwd()) {
  return {
    node: process.versions.node,
    stryker: readInstalledStrykerVersion(root),
  };
}

export function classifyMutationChangePath(filePath, options = {}) {
  const normalized = normalizeMutationPath(filePath);
  if (FINGERPRINT_CONFIG_SET.has(normalized)) return 'toolchain';
  if (GATE_SCRIPT_PATHS.has(normalized)) return 'gate_script';
  if (POLICY_ONLY_PATHS.has(normalized)) return 'policy_only';
  if (isQualityTestPath(normalized)) return 'quality_test';
  if (isUnitTestPath(normalized)) return 'unit_test';
  if (isCriticalMutationFile(normalized, options)) return 'critical_source';
  return 'unrelated';
}

export function resolveMutationCampaignPolicy(changedPaths, options = {}) {
  /** @type {Record<string, string[]>} */
  const classes = {
    critical_source: [],
    unit_test: [],
    toolchain: [],
    gate_script: [],
    policy_only: [],
    quality_test: [],
    unrelated: [],
  };
  for (const filePath of changedPaths) {
    classes[classifyMutationChangePath(filePath, options)].push(normalizeMutationPath(filePath));
  }
  for (const key of Object.keys(classes)) {
    classes[key] = sortCodeUnitStrings([...new Set(classes[key])]);
  }
  const hasCritical = classes.critical_source.length > 0;
  const hasUnitTest = classes.unit_test.length > 0;
  const hasToolchain = classes.toolchain.length > 0;
  if (!hasCritical && !hasUnitTest && !hasToolchain) {
    return {
      effectiveMode: 'changed',
      outcome: 'not_applicable',
      files: [],
      fullPatterns: null,
      classes,
      upgradeReason: null,
    };
  }
  if (hasUnitTest || hasToolchain) {
    return {
      effectiveMode: 'full',
      outcome: 'mutation_required',
      files: [],
      fullPatterns: [...CRITICAL_MUTATION_PATTERNS],
      classes,
      upgradeReason: hasCritical
        ? 'mixed_critical_source_and_test_or_toolchain'
        : hasUnitTest
          ? 'unit_test_change'
          : 'toolchain_or_config_change',
    };
  }
  const root = options.root ?? process.cwd();
  const presentCritical = classes.critical_source.filter((f) => existsSync(path.join(root, f)));
  const files = selectCriticalMutationFiles(presentCritical, options);
  if (files.length === 0) {
    return {
      effectiveMode: 'full',
      outcome: 'mutation_required',
      files: [],
      fullPatterns: [...CRITICAL_MUTATION_PATTERNS],
      classes,
      upgradeReason:
        presentCritical.length === 0
          ? 'critical_deleted_only_upgrade_full'
          : 'critical_filtered_empty_upgrade_full',
    };
  }
  return {
    effectiveMode: 'changed',
    outcome: 'mutation_required',
    files: sortCodeUnitStrings(files),
    fullPatterns: null,
    classes,
    upgradeReason: null,
  };
}

function gitText(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function gitChangedPaths(root, baseSha, headSha) {
  const named = gitText(root, [
    'diff',
    '--name-only',
    '-z',
    '--diff-filter=ACDMRTUXB',
    `${baseSha}...${headSha}`,
    '--',
  ]);
  return sortCodeUnitStrings(named.split('\0').filter(Boolean).map(normalizeMutationPath));
}

function parseGitStatusPorcelainZ(output) {
  /** @type {string[]} */
  const paths = [];
  if (!output) return paths;
  const tokens = output.split('\0');
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token || token.length < 3) {
      index += 1;
      continue;
    }
    const x = token[0];
    const y = token[1];
    const filePath = token[2] === ' ' ? token.slice(3) : token.slice(2);
    if (filePath) paths.push(normalizeMutationPath(filePath));
    index += 1;
    if (
      (x === 'R' || x === 'C' || y === 'R' || y === 'C') &&
      index < tokens.length &&
      tokens[index]
    ) {
      paths.push(normalizeMutationPath(tokens[index]));
      index += 1;
    }
  }
  return paths;
}

/** Fail closed: never treat a Git status failure as a clean tree. */
export function collectRelevantDirtyPaths(root, options = {}) {
  let porcelain = '';
  try {
    porcelain = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (error) {
    throw new Error(
      `Unable to inspect git worktree status: ${error instanceof Error ? error.message : error}`,
    );
  }
  const all = parseGitStatusPorcelainZ(porcelain);
  return sortCodeUnitStrings([
    ...new Set(
      all.filter((filePath) => {
        const kind = classifyMutationChangePath(filePath, { root: options.root ?? root });
        return kind === 'critical_source' || kind === 'unit_test' || kind === 'toolchain';
      }),
    ),
  ]);
}

function collectTrackedAndUntrackedPaths(root, predicate) {
  const scopes = ['src', 'tests', ...MUTATION_FINGERPRINT_CONFIG_PATHS];
  let tracked;
  let untracked;
  try {
    tracked = gitText(root, ['ls-files', '-z', '--', ...scopes])
      .split('\0')
      .filter(Boolean)
      .map(normalizeMutationPath);
    untracked = gitText(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...scopes])
      .split('\0')
      .filter(Boolean)
      .map(normalizeMutationPath);
  } catch (error) {
    throw new Error(
      `Unable to list git paths for mutation fingerprint: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
  /** @type {Map<string, 'present' | 'deleted'>} */
  const states = new Map();
  for (const filePath of tracked) {
    if (!predicate(filePath) && !FINGERPRINT_CONFIG_SET.has(filePath)) continue;
    states.set(filePath, existsSync(path.join(root, filePath)) ? 'present' : 'deleted');
  }
  for (const filePath of untracked) {
    if (!predicate(filePath) && !FINGERPRINT_CONFIG_SET.has(filePath)) continue;
    if (existsSync(path.join(root, filePath))) states.set(filePath, 'present');
  }
  return [...states.entries()]
    .map(([filePath, state]) => ({ path: filePath, state }))
    .sort((a, b) => compareCodeUnitStrings(a.path, b.path));
}

export function expandFullCriticalInventory(root) {
  const tracked = gitText(root, ['ls-files', '-z', '--', 'src'])
    .split('\0')
    .filter(Boolean)
    .map(normalizeMutationPath);
  return sortCodeUnitStrings(
    selectCriticalMutationFiles(tracked, { root }).filter((f) => existsSync(path.join(root, f))),
  );
}

export function collectMutationFingerprintEntries(root, options) {
  /** @type {Array<string | { path: string, state: 'present' | 'deleted' }>} */
  const entries = [];
  if (options.mode === 'changed') {
    for (const file of options.sourceInventory) entries.push(file);
  } else {
    for (const file of expandFullCriticalInventory(root)) entries.push(file);
  }
  for (const dirty of collectRelevantDirtyPaths(root, { root })) {
    const absolute = path.join(root, dirty);
    entries.push(existsSync(absolute) ? dirty : { path: dirty, state: 'deleted' });
  }
  for (const unit of collectTrackedAndUntrackedPaths(root, isMutationFingerprintTestPath)) {
    if (isMutationFingerprintTestPath(unit.path)) entries.push(unit);
  }
  for (const configPath of MUTATION_FINGERPRINT_CONFIG_PATHS) {
    if (existsSync(path.join(root, configPath))) entries.push(configPath);
  }
  for (const reportTest of options.reportTestFiles ?? []) {
    const normalized = normalizeMutationPath(reportTest);
    if (
      (isMutationFingerprintTestPath(normalized) ||
        normalized.startsWith('src/') ||
        normalized.startsWith('tests/')) &&
      existsSync(path.join(root, normalized))
    ) {
      entries.push(normalized);
    }
  }
  return entries;
}

export function fingerprintRelevantInputs(root, options) {
  const manifest = buildRelevantManifest(root, collectMutationFingerprintEntries(root, options));
  return { sha256: manifest.sha256, entryCount: manifest.entryCount };
}

export function writeJsonAtomic(targetPath, value) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, targetPath);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      /* best-effort temp cleanup */
    }
    throw error;
  }
}

export function mutationEvidencePaths(root) {
  return {
    metaPath: path.join(root, GATE_RUN_META_RELATIVE),
    scopePath: path.join(root, MUTATION_SCOPE_RELATIVE),
    reportPath: path.join(root, MUTATION_REPORT_RELATIVE),
  };
}

function rejectNonRegularEvidenceFile(absolutePath, label) {
  if (!existsSync(absolutePath)) return null;
  try {
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) return R(`${label} must not be a symlink.`);
    if (!stat.isFile()) return R(`${label} must be a regular file.`);
  } catch (error) {
    return R(`${label} is unreadable (${error instanceof Error ? error.message : error}).`);
  }
  return null;
}

/** Single public lifecycle binder for gate-run-meta.json. */
export function writeGateRunMeta(root, status, fields) {
  const { metaPath } = mutationEvidencePaths(root);
  /** @type {Record<string, unknown>} */
  const meta = { ...fields, schemaVersion: GATE_RUN_META_SCHEMA_VERSION, status };
  if (status === 'started') meta.startedAt = new Date().toISOString();
  if (status === 'failed') meta.failedAt = new Date().toISOString();
  if (status === 'completed') meta.completedAt = new Date().toISOString();
  writeJsonAtomic(metaPath, meta);
  return meta;
}

export function reportTestFilePaths(report) {
  if (!report || typeof report !== 'object') return [];
  const testFiles = /** @type {{ testFiles?: unknown }} */ (report).testFiles;
  if (!testFiles || typeof testFiles !== 'object') return [];
  return sortCodeUnitStrings(Object.keys(testFiles).map(normalizeMutationPath));
}

export function computeRawMutationScore(report) {
  const mutants = Object.entries(report?.files ?? {}).flatMap(([file, details]) =>
    (details?.mutants ?? []).map((mutant) => ({ ...mutant, file })),
  );
  const valid = mutants.filter((m) => VALID_MUTANT_STATUSES.has(m.status));
  const detected = valid.filter((m) => DETECTED_MUTANT_STATUSES.has(m.status));
  const score = valid.length === 0 ? 0 : (detected.length / valid.length) * 100;
  return { score, valid: valid.length, detected: detected.length };
}

/**
 * Shared structural binder for report ↔ scope binding (single source of truth).
 *
 * @param {{
 *   report: any;
 *   scope: any;
 *   mode: 'changed' | 'full';
 *   headSha?: string;
 *   expectedFullInventory?: string[];
 * }} input
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function validateBoundMutationReport(input) {
  const { report, scope, mode, headSha = undefined, expectedFullInventory = undefined } = input;
  const errors = [];
  if (scope?.schemaVersion !== 1) errors.push('Mutation scope schemaVersion must be 1.');
  if (scope?.mode !== mode) errors.push('Mutation scope mode does not match the gate mode.');
  if (headSha !== undefined && scope?.headSha !== headSha) {
    errors.push('Mutation scope HEAD does not match the checked commit.');
  }
  if (report?.schemaVersion !== '1.0') {
    errors.push('Stryker mutation report schemaVersion must be 1.0.');
  }
  if (report?.framework?.name !== 'StrykerJS') {
    errors.push('Mutation report framework must be StrykerJS.');
  }
  if (!report?.files || typeof report.files !== 'object') {
    errors.push('Mutation report is missing a files inventory.');
  }
  const reportFiles = sortCodeUnitStrings(
    Object.keys(report?.files ?? {}).map(normalizeMutationPath),
  );
  const reportMutate = Array.isArray(report?.config?.mutate)
    ? report.config.mutate.map((p) => String(p))
    : [];
  if (mode === 'changed') {
    const expectedFiles = Array.isArray(scope?.files)
      ? sortCodeUnitStrings([...new Set(scope.files.map(normalizeMutationPath))])
      : [];
    if (expectedFiles.length === 0) {
      errors.push('Changed mutation scope must contain at least one critical source file.');
    }
    if (
      reportFiles.length !== expectedFiles.length ||
      reportFiles.some((f, i) => f !== expectedFiles[i])
    ) {
      errors.push('Mutation report files do not exactly match the changed critical scope.');
    }
    if (!strykerMutateInputMatchesScopeFiles(reportMutate, expectedFiles)) {
      errors.push('Stryker mutate input does not exactly match the changed critical scope.');
    }
  } else if (mode === 'full') {
    const scopePatterns = Array.isArray(scope?.fullPatterns) ? scope.fullPatterns : [];
    const expectedPatterns = [...CRITICAL_MUTATION_PATTERNS];
    if (
      scopePatterns.length !== expectedPatterns.length ||
      scopePatterns.some((v, i) => v !== expectedPatterns[i])
    ) {
      errors.push('Full mutation scope patterns do not match the production policy.');
    }
    const expectedMutate = [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'];
    const normalizedReportMutate = reportMutate.map(normalizeMutationPath);
    if (
      normalizedReportMutate.length !== expectedMutate.length ||
      normalizedReportMutate.some((v, i) => v !== expectedMutate[i])
    ) {
      errors.push('Stryker full mutate input does not match the production policy.');
    }
    if (Array.isArray(expectedFullInventory)) {
      const expected = sortCodeUnitStrings(expectedFullInventory.map(normalizeMutationPath));
      if (reportFiles.length !== expected.length || reportFiles.some((f, i) => f !== expected[i])) {
        errors.push(
          'Full mutation report files do not exactly cover the expanded critical source inventory.',
        );
      }
    }
  }
  return errors.length === 0 ? { ok: true, errors } : { ok: false, errors };
}

export function classifyMutationExitDisposition(input) {
  const {
    exitCode,
    structural,
    mode,
    report,
    breakThreshold = CHANGED_MUTATION_BREAK_THRESHOLD,
  } = input;
  if (exitCode === 0 && structural.ok) return 'success';
  if (exitCode === null || exitCode === undefined) return 'failed';
  if (exitCode === 0 && !structural.ok) return 'failed';
  if (!structural.ok) return 'failed';
  if (mode !== 'changed' || !report || typeof report !== 'object') return 'failed';
  const { score, valid } = computeRawMutationScore(report);
  if (valid === 0) return 'failed';
  return score + Number.EPSILON < breakThreshold ? 'threshold_failure_allowed' : 'failed';
}

function readGateRunMeta(root) {
  const { metaPath } = mutationEvidencePaths(root);
  if (!existsSync(metaPath)) {
    return {
      ok: false,
      error: R(`Authoritative mutation run meta is missing (${GATE_RUN_META_RELATIVE}).`),
    };
  }
  const symlinkError = rejectNonRegularEvidenceFile(metaPath, 'Mutation run meta');
  if (symlinkError) return { ok: false, error: symlinkError };
  try {
    return { ok: true, meta: JSON.parse(readFileSync(metaPath, 'utf8')) };
  } catch (error) {
    return {
      ok: false,
      error: R(
        `Authoritative mutation run meta is unreadable. (${
          error instanceof Error ? error.message : error
        })`,
      ),
    };
  }
}

function isCompactFingerprint(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.sha256 === 'string' &&
    SHA256_HEX.test(value.sha256) &&
    Number.isInteger(value.entryCount) &&
    value.entryCount >= 0
  );
}

function compactFingerprintsEqual(left, right) {
  return (
    isCompactFingerprint(left) &&
    isCompactFingerprint(right) &&
    left.sha256 === right.sha256 &&
    left.entryCount === right.entryCount
  );
}

function validateGateRunMetaShape(meta) {
  const errors = [];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    errors.push(R('Mutation run meta must be an object.'));
    return errors;
  }
  if (
    Object.prototype.hasOwnProperty.call(meta, 'mutation_exit') ||
    (Object.prototype.hasOwnProperty.call(meta, 'start') &&
      Object.prototype.hasOwnProperty.call(meta, 'end') &&
      meta.schemaVersion === undefined)
  ) {
    errors.push(R('Legacy mutation run meta is not accepted.'));
    return errors;
  }
  if (meta.schemaVersion !== GATE_RUN_META_SCHEMA_VERSION) {
    errors.push(R(`Mutation run meta schemaVersion must be ${GATE_RUN_META_SCHEMA_VERSION}.`));
  }
  if (!['started', 'failed', 'completed'].includes(meta.status)) {
    errors.push(R('Mutation run meta status is invalid.'));
  } else if (meta.status === 'started') {
    errors.push(R('Mutation run meta is still started (incomplete run).'));
  } else if (meta.status === 'failed') {
    errors.push(R('Mutation run meta records a failed run.'));
  }
  if (!['changed', 'full'].includes(meta.mode)) {
    errors.push(R('Mutation run meta mode is invalid.'));
  }
  if (!['mutation_required', 'not_applicable'].includes(meta.outcome)) {
    errors.push(R('Mutation run meta outcome is invalid.'));
  }
  if (typeof meta.headSha !== 'string' || !GIT_SHA40.test(meta.headSha)) {
    errors.push(R('Mutation run meta headSha is invalid.'));
  }
  if (meta.mode === 'changed') {
    if (typeof meta.baseRef !== 'string' || meta.baseRef.length === 0) {
      errors.push(R('Mutation run meta baseRef is required in changed mode.'));
    }
    if (typeof meta.baseSha !== 'string' || !GIT_SHA40.test(meta.baseSha)) {
      errors.push(R('Mutation run meta baseSha is invalid.'));
    }
  } else if (meta.outcome === 'not_applicable') {
    if (typeof meta.baseSha !== 'string' || !GIT_SHA40.test(meta.baseSha)) {
      errors.push(R('Mutation run meta baseSha is invalid.'));
    }
  }
  if (meta.status === 'completed') {
    validateToolchainClosedShape(meta.toolchain, errors);
    if (!isCompactFingerprint(meta.fingerprintT0)) {
      errors.push(R('Mutation run meta fingerprintT0 is required.'));
    }
    if (!isCompactFingerprint(meta.fingerprintT1)) {
      errors.push(R('Mutation run meta fingerprintT1 is required.'));
    }
    if (!isCompactFingerprint(meta.fingerprint)) {
      errors.push(R('Mutation run meta final fingerprint is required.'));
    }
  }
  return errors;
}

/**
 * Closed toolchain shape: exactly `{ node: string, stryker: string }`.
 * Rejects npm, npmPin, nodePin, unknown keys, missing keys, and non-strings.
 *
 * @param {unknown} toolchain
 * @param {string[]} errors
 * @returns {toolchain is { node: string, stryker: string }}
 */
function validateToolchainClosedShape(toolchain, errors) {
  if (!toolchain || typeof toolchain !== 'object' || Array.isArray(toolchain)) {
    errors.push(R('Mutation run meta toolchain is required.'));
    return false;
  }
  const keys = Object.keys(toolchain);
  const hasExactKeys =
    keys.length === 2 &&
    Object.prototype.hasOwnProperty.call(toolchain, 'node') &&
    Object.prototype.hasOwnProperty.call(toolchain, 'stryker');
  if (!hasExactKeys) {
    errors.push(R('Mutation run meta toolchain must have exactly node and stryker string fields.'));
    return false;
  }
  const record = /** @type {{ node: unknown, stryker: unknown }} */ (toolchain);
  if (typeof record.node !== 'string' || record.node.length === 0) {
    errors.push(R('Mutation run meta toolchain.node is required.'));
    return false;
  }
  if (typeof record.stryker !== 'string' || record.stryker.length === 0) {
    errors.push(R('Mutation run meta toolchain.stryker is required.'));
    return false;
  }
  return true;
}

function rederiveCampaignPolicy(root, meta) {
  if (meta.requestedMode === 'full') {
    return {
      effectiveMode: 'full',
      outcome: 'mutation_required',
      files: [],
      fullPatterns: [...CRITICAL_MUTATION_PATTERNS],
      classes: {
        critical_source: [],
        unit_test: [],
        toolchain: [],
        gate_script: [],
        policy_only: [],
        quality_test: [],
        unrelated: [],
      },
      upgradeReason: null,
    };
  }
  if (typeof meta.baseSha !== 'string' || typeof meta.headSha !== 'string') {
    throw new Error('baseSha/headSha required to re-derive campaign policy');
  }
  return resolveMutationCampaignPolicy(gitChangedPaths(root, meta.baseSha, meta.headSha), {
    root,
  });
}

function equalSortedStringArrays(left, right) {
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

/**
 * Validate recorded toolchain against repository constants, the validating Node
 * process, and the installed local Stryker package. Env pins are ignored.
 * Node pin (EXPECTED_NODE_VERSION) is enforced unconditionally — not CI-only.
 *
 * @param {string} root
 * @param {Record<string, unknown> | undefined} toolchain
 * @param {string[]} errors
 * @param {{ actualNodeVersion?: string }} [options]
 */
function validateToolchainRecord(root, toolchain, errors, options = {}) {
  if (!toolchain) return;
  if (!validateToolchainClosedShape(toolchain, errors)) return;

  const actualNode = options.actualNodeVersion ?? process.versions.node;
  if (actualNode !== EXPECTED_NODE_VERSION) {
    errors.push(
      R(
        `Actual Node process version ${actualNode} does not match pinned Node ${EXPECTED_NODE_VERSION}.`,
      ),
    );
  }
  if (toolchain.node !== actualNode) {
    errors.push(R('Mutation run meta toolchain.node does not match the validating Node process.'));
  }
  if (toolchain.node !== EXPECTED_NODE_VERSION) {
    errors.push(R('Mutation toolchain node does not match the repository pin.'));
  }

  let installedStryker;
  try {
    installedStryker = readInstalledStrykerVersion(root);
  } catch (error) {
    errors.push(
      R(
        `Unable to read local Stryker version for evidence validation (${
          error instanceof Error ? error.message : error
        }).`,
      ),
    );
    return;
  }
  if (toolchain.stryker !== EXPECTED_STRYKER_VERSION) {
    errors.push(R('Mutation toolchain Stryker version does not match the repository pin.'));
  }
  if (toolchain.stryker !== installedStryker) {
    errors.push(R('Mutation toolchain Stryker version does not match the installed package.'));
  }
  if (installedStryker !== EXPECTED_STRYKER_VERSION) {
    errors.push(
      R(
        `Installed Stryker ${installedStryker} does not match repository pin ${EXPECTED_STRYKER_VERSION}.`,
      ),
    );
  }
}

export function resolveMutationCampaignScope(root, input) {
  const headSha = gitText(root, ['rev-parse', 'HEAD']);
  if (input.requestedMode === 'full') {
    return {
      scope: {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        mode: 'full',
        requestedMode: 'full',
        baseRef: null,
        baseSha: null,
        headSha,
        files: [],
        fullPatterns: [...CRITICAL_MUTATION_PATTERNS],
        outcome: 'mutation_required',
        upgradeReason: null,
      },
      headSha,
      baseSha: null,
      policy: null,
    };
  }
  if (!input.baseRef) throw new Error('baseRef is required for changed mode');
  const baseSha = gitText(root, ['rev-parse', `${input.baseRef}^{commit}`]);
  const policy = resolveMutationCampaignPolicy(gitChangedPaths(root, baseSha, headSha), { root });
  return {
    scope: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      mode: policy.effectiveMode,
      requestedMode: input.requestedMode,
      baseRef: input.baseRef,
      baseSha,
      headSha,
      files: policy.effectiveMode === 'changed' ? policy.files : [],
      fullPatterns: policy.effectiveMode === 'full' ? [...CRITICAL_MUTATION_PATTERNS] : null,
      outcome: policy.outcome,
      upgradeReason: policy.upgradeReason,
      changeClasses: policy.classes,
    },
    headSha,
    baseSha,
    policy,
  };
}

function resolveEvidenceHeadSha(root) {
  try {
    return { ok: true, headSha: gitText(root, ['rev-parse', 'HEAD']) };
  } catch (error) {
    return {
      ok: false,
      error: `Unable to resolve HEAD for mutation evidence: ${
        error instanceof Error ? error.message : error
      }`,
    };
  }
}

function validateEvidenceCommitBinding(root, meta, env, errors) {
  const head = resolveEvidenceHeadSha(root);
  if (head.ok === false) {
    errors.push(head.error);
    return;
  }
  if (meta.headSha !== head.headSha) {
    errors.push(R('Mutation run meta HEAD does not match the checked commit.'));
  }
  if (env.GITHUB_SHA && meta.headSha !== env.GITHUB_SHA) {
    errors.push(R('Mutation run meta HEAD must equal GITHUB_SHA in CI.'));
  }
  const requirePinnedNode = env.GITHUB_ACTIONS === 'true' || env.CI === 'true';
  if (requirePinnedNode) {
    try {
      const dirty = collectRelevantDirtyPaths(root, { root });
      if (dirty.length > 0) {
        errors.push(
          R(
            `CI mutation evidence requires a clean relevant worktree. Dirty: ${dirty
              .slice(0, 8)
              .join(', ')}.`,
          ),
        );
      }
    } catch (error) {
      errors.push(
        `Unable to inspect worktree cleanliness: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  if (meta.mode === 'changed' && typeof meta.baseRef === 'string') {
    try {
      if (gitText(root, ['rev-parse', `${meta.baseRef}^{commit}`]) !== meta.baseSha) {
        errors.push(R('Mutation run meta baseRef does not currently resolve to baseSha.'));
      }
    } catch {
      errors.push(R('Mutation run meta baseRef cannot be resolved to a commit.'));
    }
  }
}

function loadEvidenceScope(scopePath, meta, errors) {
  const scopeLinkErr = rejectNonRegularEvidenceFile(scopePath, 'Mutation scope');
  if (scopeLinkErr) return { ok: false, hardErrors: [...errors, scopeLinkErr] };
  if (!existsSync(scopePath)) {
    return { ok: false, hardErrors: [...errors, R('Mutation scope is missing.')] };
  }
  let scope;
  try {
    scope = JSON.parse(readFileSync(scopePath, 'utf8'));
  } catch {
    return { ok: false, hardErrors: [...errors, R('Mutation scope is unreadable.')] };
  }
  if (typeof meta.scopeSha256 !== 'string' || meta.scopeSha256 !== sha256File(scopePath)) {
    errors.push(R('Mutation scope SHA-256 does not match gate-run meta.'));
  }
  if (scope.mode !== meta.mode) {
    errors.push(R('Mutation scope mode does not match gate-run meta.'));
  }
  if (scope.headSha !== meta.headSha) {
    errors.push(R('Mutation scope HEAD does not match gate-run meta.'));
  }
  if (scope.outcome !== meta.outcome) {
    errors.push(R('Mutation scope outcome does not match gate-run meta.'));
  }
  return { ok: true, scope };
}

function rederiveAndValidatePolicy(root, meta, scope, errors) {
  let policy = null;
  try {
    if (
      meta.requestedMode === 'full' ||
      (typeof meta.baseSha === 'string' && typeof meta.headSha === 'string')
    ) {
      policy = rederiveCampaignPolicy(root, meta);
    } else if (meta.outcome === 'not_applicable') {
      errors.push(R('not_applicable meta cannot re-derive campaign policy without base/head.'));
    }
  } catch (error) {
    errors.push(
      R(
        `Unable to re-derive mutation campaign policy: ${
          error instanceof Error ? error.message : error
        }.`,
      ),
    );
  }
  if (!policy) return null;
  if (policy.effectiveMode !== meta.mode || policy.effectiveMode !== scope.mode) {
    errors.push(
      R('Mutation campaign policy mode no longer matches meta/scope (forged or stale mode).'),
    );
  }
  if (policy.outcome !== meta.outcome || policy.outcome !== scope.outcome) {
    errors.push(
      R(
        'Mutation campaign policy outcome no longer matches meta/scope (forged not_applicable or stale outcome).',
      ),
    );
  }
  if (policy.effectiveMode === 'changed') {
    const policyFiles = sortCodeUnitStrings(policy.files.map(normalizeMutationPath));
    const scopeFiles = sortCodeUnitStrings(
      (Array.isArray(scope.files) ? scope.files : []).map(normalizeMutationPath),
    );
    const metaFiles = sortCodeUnitStrings(
      (Array.isArray(meta.sourceInventory) ? meta.sourceInventory : []).map(normalizeMutationPath),
    );
    if (!equalSortedStringArrays(policyFiles, scopeFiles)) {
      errors.push(
        R(
          'Changed critical scope files do not match re-derived policy (omitted or extra critical source).',
        ),
      );
    }
    if (!equalSortedStringArrays(policyFiles, metaFiles)) {
      errors.push(
        R('Changed sourceInventory does not exactly match re-derived critical policy files.'),
      );
    }
  }
  return policy;
}

function validateEvidenceFingerprints(root, meta, inventory, reportTestFiles, errors) {
  const fpMode = meta.mode === 'full' ? 'full' : 'changed';
  try {
    const core = fingerprintRelevantInputs(root, {
      mode: fpMode,
      sourceInventory: inventory,
    });
    const finalFp = fingerprintRelevantInputs(root, {
      mode: fpMode,
      sourceInventory: inventory,
      reportTestFiles,
    });
    if (!compactFingerprintsEqual(meta.fingerprintT0, meta.fingerprintT1)) {
      errors.push(R('Mutation run meta records T0/T1 fingerprint drift.'));
    }
    if (!compactFingerprintsEqual(meta.fingerprintT1, core)) {
      errors.push(R('Mutation T1 fingerprint no longer matches the workspace.'));
    }
    if (!compactFingerprintsEqual(meta.fingerprint, finalFp)) {
      errors.push(
        R(
          'Mutation workspace fingerprint no longer matches completed run meta (source/test/config drift).',
        ),
      );
    }
  } catch (error) {
    errors.push(
      R(
        `Unable to recompute mutation fingerprint: ${
          error instanceof Error ? error.message : error
        }.`,
      ),
    );
  }
}

function validateRequiredMutationReport(root, meta, scope, policy, reportPath, errors) {
  if (!['success', 'threshold_failure_allowed'].includes(meta.exitDisposition)) {
    errors.push(R('Mutation run meta exit disposition is not allowed for evaluation.'));
  }
  if (meta.exitDisposition === 'success' && meta.strykerExitCode !== 0) {
    errors.push(R('success exit disposition requires strykerExitCode exactly 0.'));
  }
  if (
    meta.exitDisposition === 'threshold_failure_allowed' &&
    (meta.strykerExitCode === 0 || meta.strykerExitCode == null)
  ) {
    errors.push(R('threshold_failure_allowed requires a non-zero Stryker exit code.'));
  }
  const reportLinkErr = rejectNonRegularEvidenceFile(reportPath, 'Mutation report');
  if (reportLinkErr) return { ok: false, hardErrors: [...errors, reportLinkErr] };
  if (!existsSync(reportPath)) {
    return { ok: false, hardErrors: [...errors, R('Mutation report is missing.')] };
  }
  if (typeof meta.reportSha256 !== 'string' || meta.reportSha256 !== sha256File(reportPath)) {
    errors.push(R('Mutation report SHA-256 does not match gate-run meta.'));
  }
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return { ok: false, hardErrors: [...errors, R('Mutation report is unreadable.')] };
  }
  const expectedFullInventory =
    meta.mode === 'full' ? expandFullCriticalInventory(root) : undefined;
  const structural = validateBoundMutationReport({
    report,
    scope,
    mode: meta.mode,
    headSha: meta.headSha,
    expectedFullInventory,
  });
  if (structural.ok === false) {
    errors.push(...structural.errors.map((message) => `${message} ${MUTATION_RERUN_MESSAGE}`));
  }
  if (meta.exitDisposition === 'threshold_failure_allowed') {
    const justified = classifyMutationExitDisposition({
      exitCode: meta.strykerExitCode,
      structural: structural.ok ? { ok: true } : { ok: false },
      mode: meta.mode,
      report,
    });
    if (justified !== 'threshold_failure_allowed') {
      errors.push(
        R('threshold_failure_allowed is not justified by changed-mode below-break score.'),
      );
    }
  }
  const expectedSourceInventory =
    meta.mode === 'changed'
      ? policy
        ? sortCodeUnitStrings(policy.files.map(normalizeMutationPath))
        : sortCodeUnitStrings(
            (Array.isArray(scope.files) ? scope.files : []).map(normalizeMutationPath),
          )
      : expandFullCriticalInventory(root);
  const metaInventory = Array.isArray(meta.sourceInventory)
    ? sortCodeUnitStrings(meta.sourceInventory.map(normalizeMutationPath))
    : null;
  if (!metaInventory) {
    errors.push(R('Mutation run meta sourceInventory is required.'));
  } else if (!equalSortedStringArrays(metaInventory, expectedSourceInventory)) {
    errors.push(
      R(
        meta.mode === 'full'
          ? 'Mutation run meta full source inventory does not match current tracked critical sources.'
          : 'Mutation run meta source inventory does not exactly match the changed scope.',
      ),
    );
  }
  const expectedMutate =
    meta.mode === 'changed'
      ? toStrykerMutatePatterns(expectedSourceInventory)
      : [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'];
  const metaMutate = Array.isArray(meta.mutateInput) ? meta.mutateInput.map(String) : null;
  if (!metaMutate) {
    errors.push(R('Mutation run meta mutateInput is required.'));
  } else if (
    !equalSortedStringArrays(sortCodeUnitStrings(metaMutate), sortCodeUnitStrings(expectedMutate))
  ) {
    errors.push(R('Mutation run meta mutateInput does not match the exact escaped/policy input.'));
  }
  return { ok: true, report, expectedSourceInventory };
}

export function validateMutationRunEvidence(root, options = {}) {
  const env = options.env ?? process.env;
  const actualNodeVersion = options.actualNodeVersion;
  const errors = [];
  const { scopePath, reportPath } = mutationEvidencePaths(root);
  const read = readGateRunMeta(root);
  if (read.ok === false) return [read.error];
  const { meta } = read;
  errors.push(...validateGateRunMetaShape(meta));
  if (errors.length > 0 || meta.status !== 'completed') return errors;

  validateEvidenceCommitBinding(root, meta, env, errors);

  const scopeResult = loadEvidenceScope(scopePath, meta, errors);
  if (scopeResult.ok === false) return scopeResult.hardErrors;
  const { scope } = scopeResult;

  const policy = rederiveAndValidatePolicy(root, meta, scope, errors);
  const fpMode = meta.mode === 'full' ? 'full' : 'changed';
  const invForFp =
    fpMode === 'changed'
      ? sortCodeUnitStrings(
          (Array.isArray(meta.sourceInventory) ? meta.sourceInventory : []).map(
            normalizeMutationPath,
          ),
        )
      : expandFullCriticalInventory(root);

  const toolchainOpts = actualNodeVersion === undefined ? {} : { actualNodeVersion };

  if (meta.outcome === 'not_applicable') {
    if (meta.exitDisposition !== 'not_applicable') {
      errors.push(R('not_applicable meta requires exitDisposition exactly not_applicable.'));
    }
    if (meta.strykerExitCode !== 0) {
      errors.push(R('not_applicable success requires strykerExitCode exactly 0.'));
    }
    if (existsSync(reportPath)) {
      errors.push(
        R(
          `not_applicable runs must not leave a trusted mutation report at ${MUTATION_REPORT_RELATIVE}.`,
        ),
      );
    }
    validateEvidenceFingerprints(root, meta, [], [], errors);
    validateToolchainRecord(root, meta.toolchain, errors, toolchainOpts);
    return errors;
  }

  const reportResult = validateRequiredMutationReport(
    root,
    meta,
    scope,
    policy,
    reportPath,
    errors,
  );
  if (reportResult.ok === false) return reportResult.hardErrors;
  validateEvidenceFingerprints(
    root,
    meta,
    invForFp.length > 0 ? invForFp : reportResult.expectedSourceInventory,
    reportTestFilePaths(reportResult.report),
    errors,
  );
  validateToolchainRecord(root, meta.toolchain, errors, toolchainOpts);
  return errors;
}

export function removeStaleMutationReport(root) {
  const { reportPath } = mutationEvidencePaths(root);
  if (!existsSync(reportPath)) return;
  try {
    const stat = lstatSync(reportPath);
    if (stat.isSymbolicLink() || stat.isFile()) rmSync(reportPath, { force: true });
  } catch {
    /* best-effort cleanup */
  }
}
