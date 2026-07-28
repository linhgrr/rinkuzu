import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMutationGate } from '../../scripts/check-mutation-report.mjs';
import {
  CRITICAL_MUTATION_PATTERNS,
  toStrykerMutatePatterns,
} from '../../scripts/mutation-scope.mjs';
import {
  CHANGED_MUTATION_BREAK_THRESHOLD,
  EXPECTED_NODE_VERSION,
  EXPECTED_STRYKER_VERSION,
  MUTATION_FINGERPRINT_CONFIG_PATHS,
  MUTATION_RERUN_MESSAGE,
  buildRelevantManifest,
  buildToolchainRecord,
  classifyMutationChangePath,
  classifyMutationExitDisposition,
  collectMutationFingerprintEntries,
  collectRelevantDirtyPaths,
  computeRawMutationScore,
  fingerprintRelevantInputs,
  isMutationFingerprintTestPath,
  isMutationTestSupportPath,
  isUnitTestPath,
  resolveMutationCampaignPolicy,
  resolveSafeRepoPath,
  sha256File,
  validateMutationRunEvidence,
  writeGateRunMeta,
  writeJsonAtomic,
} from '../../scripts/mutation-run-evidence.mjs';
import {
  executeMutationGate,
  parseMutationGateArgs,
  resolveStrykerTimeoutMs,
} from '../../scripts/run-mutation-gate.mjs';

const temporaryRoots: string[] = [];
const FULL_DEFAULT_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const CHANGED_DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;

function testEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...overrides };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createGitRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rinkuzu-mutation-evidence-'));
  temporaryRoots.push(root);
  for (const args of [
    ['init'],
    ['config', 'user.email', 'mutation@test.local'],
    ['config', 'user.name', 'Mutation Test'],
  ]) {
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  }
  return root;
}

function write(root: string, rel: string, body: string) {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function git(root: string, args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function commitAll(root: string, message: string) {
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', message, '--allow-empty']);
}

function criticalSource(name = 'route.ts') {
  return `export const GET = () => Response.json({ ok: true, name: ${JSON.stringify(name)} });\n`;
}

function seedMinimalMutationRepo() {
  const root = createGitRepo();
  const files: Record<string, string> = {
    '.nvmrc': `${EXPECTED_NODE_VERSION}\n`,
    'package.json': `${JSON.stringify({ name: 'mutation-fixture', version: '0.0.0', private: true, packageManager: 'npm@10.9.8' })}\n`,
    'package-lock.json': '{"lockfileVersion":3,"packages":{}}\n',
    'stryker.config.mjs': 'export default { mutate: [] };\n',
    'vitest.config.ts': 'export default {};\n',
    'tsconfig.json': '{ "compilerOptions": {} }\n',
    'tests/setup/vitest.setup.ts': 'export {};\n',
    'tests/helpers/service-result-assert.ts': 'export const assertServiceResult = () => {};\n',
    'tests/helpers/storage.ts': 'export const storage = {};\n',
    'scripts/check-coverage-gates.mjs': 'export const isTypeOnlySource = () => false;\n',
    'scripts/mutation-scope.mjs': 'export {};\n',
    'node_modules/@stryker-mutator/core/package.json': `${JSON.stringify({ name: '@stryker-mutator/core', version: EXPECTED_STRYKER_VERSION })}\n`,
    'src/app/api/folders/[id]/route.ts': criticalSource('folders'),
    'src/models/User.ts': 'export const userModel = true;\n',
    'src/models/User.test.ts':
      "import { describe, it } from 'vitest';\ndescribe('u', () => it('ok', () => {}));\n",
    'messages/en/common.json': '{"hello":"world"}\n',
    'perf/fe-budget.json': '{"ok":true}\n',
    'public/logo.svg': '<svg />\n',
  };
  for (const [rel, body] of Object.entries(files)) write(root, rel, body);
  commitAll(root, 'seed');
  return root;
}

function baseReport(files: string[], statuses: string[] = ['Killed']) {
  return {
    schemaVersion: '1.0',
    framework: { name: 'StrykerJS', version: EXPECTED_STRYKER_VERSION },
    config: { mutate: toStrykerMutatePatterns(files) },
    files: Object.fromEntries(
      files.map((file, fileIndex) => [
        file,
        {
          source: criticalSource(file),
          mutants: statuses.map((status, index) => ({
            id: String(fileIndex * 100 + index),
            mutatorName: 'BooleanLiteral',
            replacement: index % 2 === 0 ? 'true' : 'false',
            location: {
              start: { line: index + 1, column: 0 },
              end: { line: index + 1, column: 4 },
            },
            status,
          })),
        },
      ]),
    ),
    testFiles: { 'src/models/User.test.ts': { tests: [{ id: '1', name: 'u' }] } },
  };
}

type Fp = { sha256: string; entryCount: number };
type BoundOpts = {
  mode?: 'changed' | 'full';
  outcome?: 'mutation_required' | 'not_applicable';
  files?: string[];
  statuses?: string[];
  exitDisposition?: string;
  strykerExitCode?: number | null;
  baseRef?: string;
  mutateInput?: string[];
  report?: unknown;
  omitReport?: boolean;
  fingerprintTamper?: boolean;
  reportShaTamper?: boolean;
  status?: 'completed' | 'started' | 'failed';
  omitToolchain?: boolean;
  omitFingerprintT0?: boolean;
  omitFingerprintT1?: boolean;
  requestedMode?: 'changed' | 'full';
  fingerprintOverride?: { fingerprint?: Fp; fingerprintT0?: Fp; fingerprintT1?: Fp };
  toolchainOverride?: Partial<Record<'node' | 'stryker', string>>;
  omitExitDisposition?: boolean;
};

function writeBoundCompletedEvidence(root: string, options: BoundOpts = {}) {
  const mode = options.mode ?? 'changed';
  const outcome = options.outcome ?? 'mutation_required';
  const requestedMode = options.requestedMode ?? (mode === 'full' ? 'full' : 'changed');
  const files =
    options.files ??
    (mode === 'changed' && outcome === 'mutation_required'
      ? ['src/app/api/folders/[id]/route.ts', 'src/models/User.ts']
      : []);
  const baseShaBefore = git(root, ['rev-parse', 'HEAD']);
  for (const file of files) write(root, file, criticalSource(file));
  if (outcome === 'mutation_required' && files.length > 0) {
    commitAll(root, mode === 'full' ? 'bound-full-sources' : 'bound-critical-change');
  }
  const headSha = git(root, ['rev-parse', 'HEAD']);
  const needsBase = mode === 'changed' || outcome === 'not_applicable';
  const baseRef = options.baseRef ?? (needsBase ? baseShaBefore : null);
  const baseSha = needsBase ? git(root, ['rev-parse', `${baseRef}^{commit}`]) : null;
  const scope = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    requestedMode,
    baseRef: needsBase ? baseRef : null,
    baseSha: needsBase ? baseSha : null,
    headSha,
    files: mode === 'changed' ? files : [],
    fullPatterns: mode === 'full' ? [...CRITICAL_MUTATION_PATTERNS] : null,
    outcome,
    upgradeReason: null,
  };
  writeJsonAtomic(path.join(root, 'reports/mutation/scope.json'), scope);
  if (outcome === 'mutation_required' && !options.omitReport) {
    const report = (options.report ?? baseReport(files, options.statuses ?? ['Killed'])) as {
      files?: Record<string, { source?: string }>;
    };
    const reportFiles = report.files ?? {};
    for (const file of Object.keys(reportFiles)) {
      const absolute = path.join(root, file);
      if (existsSync(absolute)) reportFiles[file].source = readFileSync(absolute, 'utf8');
    }
    writeJsonAtomic(path.join(root, 'reports/mutation/mutation.json'), report);
  }
  const mutateInput =
    options.mutateInput ??
    (mode === 'changed'
      ? toStrykerMutatePatterns(files)
      : [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}']);
  const fpMode = mode === 'full' ? 'full' : 'changed';
  const fingerprintT0 = fingerprintRelevantInputs(root, {
    mode: fpMode,
    sourceInventory: files,
  });
  const fingerprint = fingerprintRelevantInputs(root, {
    mode: fpMode,
    sourceInventory: files,
    reportTestFiles: outcome === 'mutation_required' ? ['src/models/User.test.ts'] : [],
  });
  const scopeSha256 = sha256File(path.join(root, 'reports/mutation/scope.json'));
  const reportPath = path.join(root, 'reports/mutation/mutation.json');
  const reportSha256 =
    outcome === 'mutation_required' && existsSync(reportPath) ? sha256File(reportPath) : null;
  const tamper = options.fingerprintTamper;
  const toolchain = options.omitToolchain
    ? undefined
    : {
        node: process.versions.node,
        stryker: EXPECTED_STRYKER_VERSION,
        ...options.toolchainOverride,
      };
  const metaFields: Record<string, unknown> = {
    requestedMode,
    mode,
    outcome,
    baseRef: needsBase ? baseRef : null,
    baseSha: needsBase ? baseSha : null,
    headSha,
    scopeRelative: 'reports/mutation/scope.json',
    reportRelative: 'reports/mutation/mutation.json',
    upgradeReason: null,
    exitDisposition:
      options.exitDisposition ?? (outcome === 'not_applicable' ? 'not_applicable' : 'success'),
    strykerExitCode: options.strykerExitCode === undefined ? 0 : options.strykerExitCode,
    sourceInventory: files,
    mutateInput,
    fullPatterns: mode === 'full' ? [...CRITICAL_MUTATION_PATTERNS] : null,
    scopeSha256: tamper ? '0'.repeat(64) : scopeSha256,
    reportSha256: options.reportShaTamper ? '1'.repeat(64) : reportSha256,
    fingerprint: tamper
      ? { sha256: '2'.repeat(64), entryCount: 0 }
      : (options.fingerprintOverride?.fingerprint ?? fingerprint),
    fingerprintT0: options.omitFingerprintT0
      ? undefined
      : tamper
        ? { sha256: '3'.repeat(64), entryCount: 0 }
        : (options.fingerprintOverride?.fingerprintT0 ?? fingerprintT0),
    fingerprintT1: options.omitFingerprintT1
      ? undefined
      : tamper
        ? { sha256: '4'.repeat(64), entryCount: 0 }
        : (options.fingerprintOverride?.fingerprintT1 ?? fingerprintT0),
    toolchain,
  };
  if (options.omitFingerprintT0) delete metaFields['fingerprintT0'];
  if (options.omitFingerprintT1) delete metaFields['fingerprintT1'];
  if (options.omitToolchain) delete metaFields['toolchain'];
  if (options.omitExitDisposition) delete metaFields['exitDisposition'];
  if (options.status === 'started') return writeGateRunMeta(root, 'started', metaFields);
  if (options.status === 'failed') {
    return writeGateRunMeta(root, 'failed', { ...metaFields, failureReason: 'test' });
  }
  return writeGateRunMeta(root, 'completed', metaFields);
}

function errorsOf(root: string, env: Record<string, string> = {}) {
  const errors = validateMutationRunEvidence(root, { env: testEnv(env) });
  if (!errors) throw new Error('Expected mutation evidence validation errors array.');
  return errors.join('\n');
}

function patchMeta(root: string, patch: (meta: Record<string, unknown>) => void) {
  const metaPath = path.join(root, 'reports/mutation/gate-run-meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  patch(meta);
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

const CLASSIFY_CASES = [
  ['src/app/api/folders/[id]/route.ts', 'critical_source'],
  ['src/auth.ts', 'critical_source'],
  ['src/auth.config.ts', 'critical_source'],
  ['src/lib/security/trusted-navigation.ts', 'critical_source'],
  ['src/lib/password.ts', 'critical_source'],
  ['src/lib/auth-tokens.ts', 'critical_source'],
  ['src/models/User.test.ts', 'unit_test'],
  ['src/lib/password.test.ts', 'unit_test'],
  ['src/lib/security/trusted-navigation.test.ts', 'unit_test'],
  ['scripts/run-mutation-gate.mjs', 'gate_script'],
  ['scripts/check-coverage-gates.mjs', 'toolchain'],
  ['quality/mutation-baseline.json', 'policy_only'],
  ['tests/quality/mutation-scope.test.ts', 'quality_test'],
  ['tests/performance-budget.test.ts', 'quality_test'],
  ['messages/en/common.json', 'unrelated'],
] as const;

const POLICY_CASES = [
  {
    name: 'auth-only critical requires changed campaign',
    paths: ['src/auth.ts'],
    mode: 'changed',
    outcome: 'mutation_required',
  },
  {
    name: 'auth-config-only critical requires changed campaign',
    paths: ['src/auth.config.ts'],
    mode: 'changed',
    outcome: 'mutation_required',
  },
  {
    name: 'security-helper-only critical requires changed campaign',
    paths: ['src/lib/security/trusted-navigation.ts'],
    mode: 'changed',
    outcome: 'mutation_required',
  },
  {
    name: 'password-helper-only critical requires changed campaign',
    paths: ['src/lib/password.ts'],
    mode: 'changed',
    outcome: 'mutation_required',
  },
  {
    name: 'token-helper-only critical requires changed campaign',
    paths: ['src/lib/auth-tokens.ts'],
    mode: 'changed',
    outcome: 'mutation_required',
  },
  {
    name: 'unit-test-only upgrades full',
    paths: ['src/models/User.test.ts'],
    mode: 'full',
    outcome: 'mutation_required',
  },
  {
    name: 'toolchain upgrades full',
    paths: ['stryker.config.mjs', 'package-lock.json'],
    mode: 'full',
    outcome: 'mutation_required',
  },
  {
    name: 'gate-script-only not_applicable',
    paths: ['scripts/run-mutation-gate.mjs'],
    mode: 'changed',
    outcome: 'not_applicable',
  },
  {
    name: 'policy-only not_applicable',
    paths: ['quality/mutation-waivers.json'],
    mode: 'changed',
    outcome: 'not_applicable',
  },
  {
    name: 'quality-test-only not_applicable',
    paths: ['tests/quality/foo.test.ts'],
    mode: 'changed',
    outcome: 'not_applicable',
  },
  {
    name: 'legacy quality-test-only not_applicable',
    paths: ['tests/performance-budget.test.ts'],
    mode: 'changed',
    outcome: 'not_applicable',
  },
  {
    name: 'unrelated not_applicable',
    paths: ['messages/en/common.json', 'perf/fe-budget.json'],
    mode: 'changed',
    outcome: 'not_applicable',
  },
];

const EXIT_CASES = [
  {
    name: 'below-break changed nonzero → threshold_failure_allowed',
    statuses: ['Survived', 'Survived', 'Survived', 'Killed'],
    exitCode: 1,
    mode: 'changed' as const,
    expected: 'threshold_failure_allowed',
  },
  {
    name: 'green changed nonzero → failed',
    statuses: Array.from({ length: 20 }, () => 'Killed'),
    exitCode: 1,
    mode: 'changed' as const,
    expected: 'failed',
  },
  {
    name: 'full mode nonzero → failed',
    statuses: ['Survived', 'Survived', 'Survived', 'Killed'],
    exitCode: 1,
    mode: 'full' as const,
    expected: 'failed',
  },
  {
    name: 'zero + structural ok → success',
    statuses: Array.from({ length: 20 }, () => 'Killed'),
    exitCode: 0,
    mode: 'changed' as const,
    expected: 'success',
  },
  {
    name: 'null exit → failed',
    statuses: ['Survived'],
    exitCode: null,
    mode: 'changed' as const,
    expected: 'failed',
  },
];

const LIFECYCLE_CASES = [
  { name: 'missing meta', setup: (_r: string) => undefined, match: /missing/ },
  {
    name: 'legacy envelope',
    setup: (root: string) =>
      writeJsonAtomic(path.join(root, 'reports/mutation/gate-run-meta.json'), {
        start: '2026-07-17T05:49:07Z',
        end: '2026-07-17T05:53:29Z',
        mutation_exit: 0,
      }),
    match: /Legacy mutation run meta/,
  },
  {
    name: 'started',
    setup: (root: string) => writeBoundCompletedEvidence(root, { status: 'started' }),
    match: /started \(incomplete run\)/,
  },
  {
    name: 'failed',
    setup: (root: string) => writeBoundCompletedEvidence(root, { status: 'failed' }),
    match: /records a failed run/,
  },
];

const BINDING_CASES = [
  { name: 'report hash drift', options: { reportShaTamper: true }, match: /report SHA-256/ },
  {
    name: 'scope/fingerprint tamper',
    options: { fingerprintTamper: true },
    match: /scope SHA-256|fingerprint/,
  },
  {
    name: 'success with null strykerExitCode',
    options: { exitDisposition: 'success', strykerExitCode: null },
    match: /strykerExitCode exactly 0/,
  },
  { name: 'missing toolchain', options: { omitToolchain: true }, match: /toolchain is required/ },
  {
    name: 'missing fingerprintT0',
    options: { omitFingerprintT0: true },
    match: /fingerprintT0 is required/,
  },
  {
    name: 'missing fingerprintT1',
    options: { omitFingerprintT1: true },
    match: /fingerprintT1 is required/,
  },
];

const DRIFT_CASES = [
  {
    name: 'unit-test edit after completed',
    mutate: (root: string) =>
      write(
        root,
        'src/models/User.test.ts',
        "import { describe, it } from 'vitest';\ndescribe('u', () => it('changed', () => {}));\n",
      ),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: 'helper edit after completed',
    mutate: (root: string) =>
      write(root, 'tests/helpers/storage.ts', 'export const storage = { dirty: true };\n'),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: 'unit-test delete',
    mutate: (root: string) => rmSync(path.join(root, 'src/models/User.test.ts'), { force: true }),
    match: /fingerprint|missing|unreadable|drift/,
  },
  {
    name: 'untracked unit-test add',
    mutate: (root: string) =>
      write(
        root,
        'src/models/Extra.unit.test.ts',
        "import { describe, it } from 'vitest';\ndescribe('extra', () => it('ok', () => {}));\n",
      ),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: 'stryker config drift',
    mutate: (root: string) =>
      write(root, 'stryker.config.mjs', 'export default { mutate: ["changed"] };\n'),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: 'package-lock drift',
    mutate: (root: string) =>
      write(root, 'package-lock.json', '{"lockfileVersion":3,"packages":{"x":{}}}\n'),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: '.nvmrc drift',
    mutate: (root: string) => write(root, '.nvmrc', '20.0.0\n'),
    match: /fingerprint|drift|Dirty/,
  },
  {
    name: 'base/head move',
    mutate: (root: string) => {
      write(root, 'src/models/User.ts', 'export const userModel = "dirty";\n');
      commitAll(root, 'move-head');
    },
    match: /HEAD does not match|fingerprint|source|policy/,
  },
  {
    name: 'out-of-scope dirty critical',
    mutate: (root: string) =>
      write(root, 'src/models/User.ts', 'export const userModel = "out-of-scope-dirt";\n'),
    match: /fingerprint|drift|Dirty/,
    files: ['src/app/api/folders/[id]/route.ts'],
  },
];

const TOOLCHAIN_CASES = [
  {
    name: 'wrong recorded node',
    toolchainOverride: { node: '20.0.0' },
    match:
      /toolchain\.node does not match the validating Node process|toolchain node does not match the repository pin/,
  },
  {
    name: 'wrong recorded Stryker',
    toolchainOverride: { stryker: '9.0.0' },
    match: /Stryker version does not match the repository pin|installed package/,
  },
];

const TOOLCHAIN_SHAPE_CASES = [
  {
    name: 'bare npm key',
    patch: (toolchain: Record<string, unknown>) => {
      toolchain['npm'] = '10.9.8';
    },
    match: /exactly node and stryker/,
  },
  {
    name: 'npmPin key',
    patch: (toolchain: Record<string, unknown>) => {
      toolchain['npmPin'] = '10.9.8';
    },
    match: /exactly node and stryker/,
  },
  {
    name: 'nodePin key',
    patch: (toolchain: Record<string, unknown>) => {
      toolchain['nodePin'] = EXPECTED_NODE_VERSION;
    },
    match: /exactly node and stryker/,
  },
  {
    name: 'unknown extra key',
    patch: (toolchain: Record<string, unknown>) => {
      toolchain['extra'] = 'nope';
    },
    match: /exactly node and stryker/,
  },
  {
    name: 'missing stryker key',
    patch: (toolchain: Record<string, unknown>) => {
      delete toolchain['stryker'];
    },
    match: /exactly node and stryker|toolchain\.stryker is required/,
  },
  {
    name: 'non-string node',
    patch: (toolchain: Record<string, unknown>) => {
      toolchain['node'] = 22;
    },
    match: /toolchain\.node is required|exactly node and stryker/,
  },
];

const SECURITY_CASES = [
  {
    name: 'stored T0 vs T1 entryCount mismatch',
    setup: (root: string) => {
      const good = fingerprintRelevantInputs(root, {
        mode: 'changed',
        sourceInventory: ['src/app/api/folders/[id]/route.ts', 'src/models/User.ts'],
      });
      writeBoundCompletedEvidence(root, {
        fingerprintOverride: {
          fingerprintT0: good,
          fingerprintT1: { sha256: good.sha256, entryCount: good.entryCount + 7 },
        },
      });
    },
    match: /T0\/T1 fingerprint drift/,
  },
  {
    name: 'entryCount tamper with preserved sha256',
    setup: (root: string) => {
      writeBoundCompletedEvidence(root);
      patchMeta(root, (meta) => {
        for (const key of ['fingerprint', 'fingerprintT0', 'fingerprintT1'] as const) {
          const fp = meta[key] as Fp;
          meta[key] = { ...fp, entryCount: fp.entryCount + 99 };
        }
      });
    },
    match: /fingerprint|entryCount|no longer matches|T0\/T1/,
  },
  {
    name: 'forged threshold_failure_allowed over green report',
    setup: (root: string) =>
      writeBoundCompletedEvidence(root, {
        files: ['src/models/User.ts'],
        statuses: Array.from({ length: 20 }, () => 'Killed'),
        exitDisposition: 'threshold_failure_allowed',
        strykerExitCode: 1,
      }),
    match: /threshold_failure_allowed is not justified by changed-mode below-break score/,
  },
  {
    name: 'baseRef no longer resolves to baseSha',
    setup: (root: string) => {
      writeBoundCompletedEvidence(root);
      patchMeta(root, (meta) => {
        meta['baseSha'] = 'a'.repeat(40);
      });
    },
    match: /baseRef does not currently resolve to baseSha/,
  },
  {
    name: 'missing not_applicable exitDisposition',
    setup: (root: string) =>
      writeBoundCompletedEvidence(root, {
        outcome: 'not_applicable',
        files: [],
        omitReport: true,
        omitExitDisposition: true,
      }),
    match: /not_applicable meta requires exitDisposition exactly not_applicable/,
  },
  {
    name: 'wrong not_applicable exitDisposition',
    setup: (root: string) =>
      writeBoundCompletedEvidence(root, {
        outcome: 'not_applicable',
        files: [],
        omitReport: true,
        exitDisposition: 'success',
      }),
    match: /not_applicable meta requires exitDisposition exactly not_applicable/,
  },
];

const FAIL_CLOSED_CASES = [
  {
    name: 'nonzero green-score',
    files: ['src/models/User.ts'],
    source: 'export const userModel = 42;\n',
    reportStatuses: Array.from({ length: 20 }, () => 'Killed'),
    exitStatus: 1 as number | null,
    signal: null as string | null,
    failureReason: 'materialization_or_hard_failure',
  },
  {
    name: 'invalid materialization on zero exit',
    files: ['src/models/User.ts'],
    source: 'export const userModel = 2;\n',
    badReport: true,
    exitStatus: 0 as number | null,
    signal: null as string | null,
    failureReason: 'materialization_or_hard_failure',
  },
  {
    name: 'signal-only child death',
    files: ['src/models/User.ts'],
    source: 'export const userModel = 5;\n',
    exitStatus: null as number | null,
    signal: 'SIGKILL' as string | null,
    failureReason: 'stryker_signal_death',
  },
];

describe('mutation run evidence helpers', () => {
  it.each(CLASSIFY_CASES)('classifies %s as %s', (filePath, kind) => {
    expect(classifyMutationChangePath(filePath)).toBe(kind);
  });

  it('unit-test and support path filters', () => {
    expect(isUnitTestPath('src/models/User.test.ts')).toBe(true);
    expect(isUnitTestPath('tests/quality/mutation-scope.test.ts')).toBe(false);
    expect(isUnitTestPath('tests/e2e/login.spec.ts')).toBe(false);
    expect(isMutationTestSupportPath('tests/helpers/service-result-assert.ts')).toBe(true);
    expect(isMutationTestSupportPath('tests/helpers/storage.ts')).toBe(true);
    expect(isMutationTestSupportPath('tests/setup/vitest.setup.ts')).toBe(true);
    expect(isMutationTestSupportPath('src/lib/__mocks__/auth.ts')).toBe(true);
    expect(isMutationTestSupportPath('src/features/quiz/components/QuizCard.tsx')).toBe(false);
    expect(isMutationFingerprintTestPath('tests/helpers/storage.ts')).toBe(true);
    expect(isMutationFingerprintTestPath('src/models/User.test.ts')).toBe(true);
    expect(isMutationFingerprintTestPath('tests/e2e/login.spec.ts')).toBe(false);
  });

  it.each(POLICY_CASES)('policy: $name', ({ paths, mode, outcome }) => {
    const policy = resolveMutationCampaignPolicy([...paths]);
    expect(policy.effectiveMode).toBe(mode);
    expect(policy.outcome).toBe(outcome);
  });

  it('keeps critical-only changed; deleted critical upgrades full', () => {
    const root = seedMinimalMutationRepo();
    expect(
      resolveMutationCampaignPolicy(['src/app/api/folders/[id]/route.ts'], { root }).effectiveMode,
    ).toBe('changed');
    const deleted = resolveMutationCampaignPolicy(['src/models/Ghost.ts'], { root });
    expect(deleted).toMatchObject({
      outcome: 'mutation_required',
      effectiveMode: 'full',
      upgradeReason: 'critical_deleted_only_upgrade_full',
    });
  });

  it('builds compact manifests and rejects absolute/traversal paths', () => {
    const root = seedMinimalMutationRepo();
    const manifest = buildRelevantManifest(root, [
      'package-lock.json',
      'src/models/User.ts',
      'package-lock.json',
    ]);
    expect(manifest.entries.map((e) => e.path)).toEqual([
      'package-lock.json',
      'src/models/User.ts',
    ]);
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.entryCount).toBe(2);
    expect(() => buildRelevantManifest(root, ['/etc/passwd'])).toThrow(/absolute/);
    expect(() => buildRelevantManifest(root, ['../outside.ts'])).toThrow(/unsafe|escapes/);
  });

  it('accepts Next.js route-group parentheses in safe repository paths', () => {
    const root = seedMinimalMutationRepo();
    const resolved = resolveSafeRepoPath(root, 'src/app/[locale]/(app)/quizzes/page.tsx');

    expect(resolved).toMatchObject({
      ok: true,
      normalized: 'src/app/[locale]/(app)/quizzes/page.tsx',
    });
  });

  it.each(EXIT_CASES)('exit disposition: $name', ({ statuses, exitCode, mode, expected }) => {
    const report = baseReport(['src/models/User.ts'], statuses);
    if (expected === 'threshold_failure_allowed') {
      expect(computeRawMutationScore(report).score).toBeLessThan(CHANGED_MUTATION_BREAK_THRESHOLD);
    }
    expect(
      classifyMutationExitDisposition({ exitCode, structural: { ok: true }, mode, report }),
    ).toBe(expected);
  });

  it('fingerprint config excludes package.json, gate scripts, and tsconfig.scripts.json', () => {
    expect(MUTATION_FINGERPRINT_CONFIG_PATHS).toEqual(
      expect.arrayContaining([
        'scripts/check-coverage-gates.mjs',
        'scripts/mutation-scope.mjs',
        'tsconfig.json',
        'tests/setup/vitest.setup.ts',
      ]),
    );
    expect(MUTATION_FINGERPRINT_CONFIG_PATHS).not.toEqual(
      expect.arrayContaining([
        'package.json',
        'scripts/run-mutation-gate.mjs',
        'tsconfig.scripts.json',
      ]),
    );
  });

  it('fingerprints helpers and setup support files (including current repo helpers)', () => {
    const root = seedMinimalMutationRepo();
    const entries = collectMutationFingerprintEntries(root, {
      mode: 'changed',
      sourceInventory: [],
    });
    const paths = entries.map((entry) => (typeof entry === 'string' ? entry : entry.path));
    expect(paths).toEqual(
      expect.arrayContaining([
        'tests/helpers/service-result-assert.ts',
        'tests/helpers/storage.ts',
        'tests/setup/vitest.setup.ts',
        'src/models/User.test.ts',
      ]),
    );
    expect(paths.some((p) => p.includes('QuizCard'))).toBe(false);
  });

  it('collectRelevantDirtyPaths fails closed when git status fails', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rinkuzu-no-git-'));
    temporaryRoots.push(root);
    expect(() => collectRelevantDirtyPaths(root)).toThrow(/Unable to inspect git worktree status/);
  });

  it('buildToolchainRecord reads installed Stryker and process Node only', () => {
    const root = seedMinimalMutationRepo();
    const toolchain = buildToolchainRecord(root);
    expect(toolchain).toEqual({
      node: process.versions.node,
      stryker: EXPECTED_STRYKER_VERSION,
    });
    expect(Object.keys(toolchain).sort()).toEqual(['node', 'stryker']);
    expect(toolchain).not.toHaveProperty('npm');
    expect(toolchain).not.toHaveProperty('npmPin');
    expect(toolchain).not.toHaveProperty('nodePin');
  });

  it('buildToolchainRecord fails closed when local Stryker package is missing', () => {
    const root = createGitRepo();
    expect(() => buildToolchainRecord(root)).toThrow(/@stryker-mutator\/core/);
  });
});

describe('gate-run-meta validation', () => {
  it.each(LIFECYCLE_CASES)('lifecycle reject: $name', ({ setup, match }) => {
    const root = seedMinimalMutationRepo();
    setup(root);
    const errors = errorsOf(root);
    expect(errors).toMatch(match);
    expect(errors).toContain(MUTATION_RERUN_MESSAGE);
  });

  it.each(BINDING_CASES)('binding reject: $name', ({ options, match }) => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, options);
    expect(errorsOf(root)).toMatch(match);
  });

  it.each(DRIFT_CASES)('post-run drift: $name', ({ mutate, match, files }) => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, files ? { files } : {});
    expect(validateMutationRunEvidence(root, { env: testEnv() })).toEqual([]);
    mutate(root);
    const errors = errorsOf(root);
    expect(errors).toMatch(match);
    expect(errors).toContain(MUTATION_RERUN_MESSAGE);
  });

  it.each(TOOLCHAIN_CASES)('toolchain pin reject: $name', ({ toolchainOverride, match }) => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, { toolchainOverride });
    expect(errorsOf(root)).toMatch(match);
  });

  it.each(TOOLCHAIN_SHAPE_CASES)('toolchain closed shape reject: $name', ({ patch, match }) => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root);
    patchMeta(root, (meta) => {
      const toolchain = { ...(meta['toolchain'] as Record<string, unknown>) };
      patch(toolchain);
      meta['toolchain'] = toolchain;
    });
    expect(errorsOf(root)).toMatch(match);
  });

  it('rejects actual Node when it does not match the repository pin (injected)', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root);
    const validationErrors = validateMutationRunEvidence(root, {
      env: testEnv(),
      actualNodeVersion: '20.11.0',
    });
    if (!validationErrors) throw new Error('Expected mutation evidence validation errors array.');
    const errors = validationErrors.join('\n');
    expect(errors).toMatch(/Actual Node process version 20\.11\.0 does not match pinned Node/);
    expect(errors).toMatch(/toolchain\.node does not match the validating Node process/);
    expect(errors).toContain(MUTATION_RERUN_MESSAGE);
  });

  it('environment cannot steer expected Node or Stryker pins', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root);
    const steered = validateMutationRunEvidence(root, {
      env: testEnv({
        MUTATION_EXPECTED_NODE: '20.0.0',
        MUTATION_EXPECTED_NPM: '9.0.0',
        STRYKER_VERSION: '9.0.0',
      }),
    });
    expect(steered).toEqual([]);

    writeBoundCompletedEvidence(root, { toolchainOverride: { stryker: '9.0.0' } });
    const wrongDespiteEnv = errorsOf(root, {
      STRYKER_VERSION: '9.0.0',
      MUTATION_EXPECTED_NODE: process.versions.node,
      MUTATION_EXPECTED_STRYKER: '9.0.0',
    });
    expect(wrongDespiteEnv).toMatch(/Stryker version does not match the repository pin/);

    writeBoundCompletedEvidence(root, { toolchainOverride: { node: '20.0.0' } });
    const wrongNodeDespiteEnv = errorsOf(root, {
      MUTATION_EXPECTED_NODE: '20.0.0',
      STRYKER_VERSION: EXPECTED_STRYKER_VERSION,
    });
    expect(wrongNodeDespiteEnv).toMatch(
      /toolchain\.node does not match the validating Node process|repository pin/,
    );
  });

  it.each(SECURITY_CASES)('security reject: $name', ({ setup, match }) => {
    const root = seedMinimalMutationRepo();
    setup(root);
    expect(errorsOf(root)).toMatch(match);
  });

  it('CI path fails closed when git status cannot be inspected', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, { outcome: 'not_applicable', files: [], omitReport: true });
    rmSync(path.join(root, '.git'), { recursive: true, force: true });
    expect(errorsOf(root, { CI: 'true' })).toMatch(
      /Unable to resolve HEAD|Unable to inspect worktree cleanliness|Unable to inspect git worktree status/,
    );
  });

  it('ignores unrelated perf/messages/public dirt for local checks', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root);
    write(root, 'perf/local-measurement.json', '{"x":1}\n');
    write(root, 'messages/en/common.json', '{"hello":"changed"}\n');
    write(root, 'public/logo.svg', '<svg id="x" />\n');
    expect(validateMutationRunEvidence(root, { env: testEnv() })).toEqual([]);
  });

  it('accepts not_applicable completed meta without a score-bearing report', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, { outcome: 'not_applicable', files: [], omitReport: true });
    expect(validateMutationRunEvidence(root, { env: testEnv() })).toEqual([]);
    const result = runMutationGate(root, { env: testEnv() });
    expect(result).toMatchObject({ errors: [], outcome: 'not_applicable' });
  });

  it('rejects forged not_applicable while critical diff exists', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/models/User.ts', 'export const userModel = "critical-change";\n');
    commitAll(root, 'critical-change');
    const headSha = git(root, ['rev-parse', 'HEAD']);
    const fingerprint = fingerprintRelevantInputs(root, {
      mode: 'changed',
      sourceInventory: [],
    });
    const scope = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      mode: 'changed',
      requestedMode: 'changed',
      baseRef: baseSha,
      baseSha,
      headSha,
      files: [],
      fullPatterns: null,
      outcome: 'not_applicable',
      upgradeReason: null,
    };
    writeJsonAtomic(path.join(root, 'reports/mutation/scope.json'), scope);
    writeGateRunMeta(root, 'completed', {
      requestedMode: 'changed',
      mode: 'changed',
      outcome: 'not_applicable',
      baseRef: baseSha,
      baseSha,
      headSha,
      scopeRelative: 'reports/mutation/scope.json',
      reportRelative: 'reports/mutation/mutation.json',
      upgradeReason: null,
      exitDisposition: 'not_applicable',
      strykerExitCode: 0,
      sourceInventory: [],
      mutateInput: [],
      scopeSha256: sha256File(path.join(root, 'reports/mutation/scope.json')),
      reportSha256: null,
      fingerprint,
      fingerprintT0: fingerprint,
      fingerprintT1: fingerprint,
      toolchain: { node: process.versions.node, stryker: EXPECTED_STRYKER_VERSION },
    });
    expect(errorsOf(root)).toMatch(/forged not_applicable|policy outcome|no longer matches/);
  });

  it('rejects omitted second changed critical file from inventory', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/app/api/folders/[id]/route.ts', criticalSource('folders-v2'));
    write(root, 'src/models/User.ts', 'export const userModel = 99;\n');
    commitAll(root, 'two-critical');
    const files = ['src/app/api/folders/[id]/route.ts'];
    const headSha = git(root, ['rev-parse', 'HEAD']);
    const report = baseReport(files, ['Killed']);
    for (const file of files) {
      report.files[file].source = readFileSync(path.join(root, file), 'utf8');
    }
    writeJsonAtomic(path.join(root, 'reports/mutation/mutation.json'), report);
    writeJsonAtomic(path.join(root, 'reports/mutation/scope.json'), {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      mode: 'changed',
      requestedMode: 'changed',
      baseRef: baseSha,
      baseSha,
      headSha,
      files,
      fullPatterns: null,
      outcome: 'mutation_required',
      upgradeReason: null,
    });
    const fingerprintT0 = fingerprintRelevantInputs(root, {
      mode: 'changed',
      sourceInventory: files,
    });
    const fingerprint = fingerprintRelevantInputs(root, {
      mode: 'changed',
      sourceInventory: files,
      reportTestFiles: ['src/models/User.test.ts'],
    });
    writeGateRunMeta(root, 'completed', {
      requestedMode: 'changed',
      mode: 'changed',
      outcome: 'mutation_required',
      baseRef: baseSha,
      baseSha,
      headSha,
      scopeRelative: 'reports/mutation/scope.json',
      reportRelative: 'reports/mutation/mutation.json',
      upgradeReason: null,
      exitDisposition: 'success',
      strykerExitCode: 0,
      sourceInventory: files,
      mutateInput: toStrykerMutatePatterns(files),
      fullPatterns: null,
      scopeSha256: sha256File(path.join(root, 'reports/mutation/scope.json')),
      reportSha256: sha256File(path.join(root, 'reports/mutation/mutation.json')),
      fingerprint,
      fingerprintT0,
      fingerprintT1: fingerprintT0,
      toolchain: { node: process.versions.node, stryker: EXPECTED_STRYKER_VERSION },
    });
    expect(errorsOf(root)).toMatch(/omitted|re-derived|source inventory|policy/);
  });

  it('rejects full report subset of expanded critical inventory', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, {
      mode: 'full',
      requestedMode: 'full',
      files: ['src/app/api/folders/[id]/route.ts'],
      report: {
        schemaVersion: '1.0',
        framework: { name: 'StrykerJS', version: EXPECTED_STRYKER_VERSION },
        config: {
          mutate: [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'],
        },
        files: {
          'src/app/api/folders/[id]/route.ts': {
            source: criticalSource('folders'),
            mutants: [
              {
                id: '1',
                mutatorName: 'BooleanLiteral',
                replacement: 'true',
                location: { start: { line: 1, column: 0 }, end: { line: 1, column: 4 } },
                status: 'Killed',
              },
            ],
          },
        },
        testFiles: { 'src/models/User.test.ts': { tests: [{ id: '1', name: 'u' }] } },
      },
    });
    expect(errorsOf(root)).toMatch(/exactly cover|full source inventory|expanded critical/);
  });

  it('rejects symlink evidence files', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root);
    const metaPath = path.join(root, 'reports/mutation/gate-run-meta.json');
    const backup = `${metaPath}.real`;
    writeFileSync(backup, readFileSync(metaPath));
    rmSync(metaPath);
    symlinkSync(backup, metaPath);
    expect(errorsOf(root)).toContain('symlink');
  });

  it('forces status/schema after caller fields and cleans atomic temp on failure', () => {
    const root = seedMinimalMutationRepo();
    const started = writeGateRunMeta(root, 'started', {
      status: 'completed',
      schemaVersion: 99,
      mode: 'changed',
      outcome: 'mutation_required',
      headSha: 'a'.repeat(40),
    });
    expect(started['status']).toBe('started');
    expect(started['schemaVersion']).toBe(1);
    const notDir = path.join(root, 'reports/mutation/not-a-dir');
    writeFileSync(notDir, 'file', 'utf8');
    expect(() => writeJsonAtomic(path.join(notDir, 'child.json'), { a: 1 })).toThrow();
    expect(readdirSync(path.join(root, 'reports/mutation')).some((n) => n.endsWith('.tmp'))).toBe(
      false,
    );
  });

  it('round-trips changed bracket-id mutate binding with compact fingerprints', () => {
    const root = seedMinimalMutationRepo();
    writeBoundCompletedEvidence(root, {
      files: ['src/app/api/folders/[id]/route.ts'],
      statuses: ['Killed'],
    });
    expect(validateMutationRunEvidence(root, { env: testEnv() })).toEqual([]);
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta.mutateInput).toEqual(['src/app/api/folders/[[]id]/route.ts']);
    expect(meta.toolchain).toEqual({
      node: process.versions.node,
      stryker: EXPECTED_STRYKER_VERSION,
    });
    expect(meta.toolchain).not.toHaveProperty('npmPin');
    expect(meta.toolchain).not.toHaveProperty('nodePin');
    expect(meta.fingerprint).toEqual(
      expect.objectContaining({
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        entryCount: expect.any(Number),
      }),
    );
    expect(meta.fingerprint).not.toHaveProperty('entries');
  });
});

describe('run-mutation-gate orchestration', () => {
  it('parses --mode changed --base-ref and --mode full', () => {
    expect(parseMutationGateArgs(['--mode', 'full'])).toEqual({ mode: 'full', baseRef: null });
    expect(parseMutationGateArgs(['--mode=changed', '--base-ref=abc'])).toEqual({
      mode: 'changed',
      baseRef: 'abc',
    });
    expect(() => parseMutationGateArgs(['--mode', 'changed'])).toThrow(/base-ref/);
  });

  it('defaults Stryker timeout by mode and bounds operational env override', () => {
    expect(resolveStrykerTimeoutMs(testEnv(), 'changed')).toBe(CHANGED_DEFAULT_TIMEOUT_MS);
    expect(resolveStrykerTimeoutMs(testEnv(), 'full')).toBe(FULL_DEFAULT_TIMEOUT_MS);
    expect(
      resolveStrykerTimeoutMs(testEnv({ MUTATION_STRYKER_TIMEOUT_MS: '120000' }), 'full'),
    ).toBe(120_000);
    expect(() =>
      resolveStrykerTimeoutMs(testEnv({ MUTATION_STRYKER_TIMEOUT_MS: '1000' }), 'changed'),
    ).toThrow(/between/);
    expect(() =>
      resolveStrykerTimeoutMs(
        testEnv({ MUTATION_STRYKER_TIMEOUT_MS: String(7 * 60 * 60 * 1000) }),
        'full',
      ),
    ).toThrow(/between/);
  });

  it('atomically completes meta only after valid materialization; threshold exit stays completed', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/app/api/folders/[id]/route.ts', criticalSource('folders-v2'));
    commitAll(root, 'critical-change');
    const files = ['src/app/api/folders/[id]/route.ts'] as const;
    const sourceOnDisk = readFileSync(path.join(root, files[0]), 'utf8');
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      invokeStrykerFn: () => {
        const report = baseReport(
          [...files],
          ['Survived', 'Survived', 'Survived', 'Survived', 'Killed'],
        );
        report.files[files[0]].source = sourceOnDisk;
        writeJsonAtomic(path.join(root, 'reports/mutation/mutation.json'), report);
        return { status: 1, signal: null, error: undefined, stdout: '', stderr: 'threshold' };
      },
      evaluateFn: () => ({
        errors: ['score red'],
        score: 0,
        valid: 1,
        detected: 0,
        survived: 1,
        noCoverage: 0,
        belowHighWatermark: true,
      }),
    });
    expect(result).toMatchObject({
      status: 'completed',
      exitDisposition: 'threshold_failure_allowed',
      exitCode: 1,
    });
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta).toMatchObject({
      status: 'completed',
      exitDisposition: 'threshold_failure_allowed',
      strykerExitCode: 1,
      toolchain: { node: process.versions.node, stryker: EXPECTED_STRYKER_VERSION },
    });
    expect(meta.fingerprintT0).not.toHaveProperty('entries');
  });

  it.each(FAIL_CLOSED_CASES)(
    'fails closed: $name',
    ({ files, source, reportStatuses, exitStatus, signal, failureReason, badReport }) => {
      const root = seedMinimalMutationRepo();
      const baseSha = git(root, ['rev-parse', 'HEAD']);
      write(root, files[0], source);
      commitAll(root, `case-${files[0]}`);
      const sourceOnDisk = readFileSync(path.join(root, files[0]), 'utf8');
      const result = executeMutationGate(root, {
        mode: 'changed',
        baseRef: baseSha,
        env: testEnv(),
        invokeStrykerFn: () => {
          if (badReport) {
            writeJsonAtomic(path.join(root, 'reports/mutation/mutation.json'), {
              schemaVersion: '1.0',
              framework: { name: 'StrykerJS', version: EXPECTED_STRYKER_VERSION },
              config: { mutate: ['src/other.ts'] },
              files: {
                'src/other.ts': { source: 'export {};\n', mutants: [] },
              },
            });
          } else if (reportStatuses) {
            const report = baseReport(files, reportStatuses);
            report.files[files[0]].source = sourceOnDisk;
            writeJsonAtomic(path.join(root, 'reports/mutation/mutation.json'), report);
          }
          return { status: exitStatus, signal, error: undefined, stdout: '', stderr: '' };
        },
        evaluateFn: () => {
          throw new Error('should not evaluate failed materialization disposition');
        },
      });
      expect(result.status).toBe('failed');
      const meta = JSON.parse(
        readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
      );
      expect(meta.failureReason).toBe(failureReason);
    },
  );

  it('records bounded Stryker diagnostics when no mutation report is produced', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/models/User.ts', 'export const userModel = 17;\n');
    commitAll(root, 'critical-without-report');
    const stderr = `${'x'.repeat(9 * 1024)}\nDry run failed because a unit test failed`;
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      invokeStrykerFn: () => ({
        status: 1,
        signal: null,
        error: undefined,
        stdout: 'Stryker started',
        stderr,
      }),
      evaluateFn: () => {
        throw new Error('should not evaluate missing report');
      },
    });
    expect(result.status).toBe('failed');
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta).toMatchObject({
      failureReason: 'report_missing_after_stryker',
      strykerExitCode: 1,
      strykerStdoutTail: 'Stryker started',
    });
    expect(meta.strykerStderrTail).toContain('Dry run failed because a unit test failed');
    expect(meta.strykerStderrTail.length).toBeLessThanOrEqual(8 * 1024);
  });

  it('handles not_applicable without Stryker dry-run and removes stale report', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'messages/en/common.json', '{"hello":"unrelated"}\\n');
    commitAll(root, 'unrelated-only');
    writeJsonAtomic(
      path.join(root, 'reports/mutation/mutation.json'),
      baseReport(['src/models/User.ts']),
    );
    let invokeCount = 0;
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      invokeStrykerFn: () => {
        invokeCount += 1;
        return { status: 0, signal: null, error: undefined, stdout: '', stderr: '' };
      },
      evaluateFn: () => {
        throw new Error('not_applicable should not score');
      },
    });
    expect(invokeCount).toBe(0);
    expect(result).toMatchObject({ status: 'completed', outcome: 'not_applicable' });
    expect(existsSync(path.join(root, 'reports/mutation/mutation.json'))).toBe(false);
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta.outcome).toBe('not_applicable');
    expect(meta.exitDisposition).toBe('not_applicable');
    expect(meta.fingerprintT0?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.fingerprintT1?.sha256).toBe(meta.fingerprintT0.sha256);
    expect(meta.fingerprintT1?.entryCount).toBe(meta.fingerprintT0.entryCount);
    expect(meta.fingerprint?.sha256).toBe(meta.fingerprintT0.sha256);
  });

  it('fails closed when installed Stryker package is missing before campaign', () => {
    const root = seedMinimalMutationRepo();
    rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/models/User.ts', 'export const userModel = 7;\n');
    commitAll(root, 'critical-no-stryker');
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      invokeStrykerFn: () => {
        throw new Error('should not invoke without toolchain');
      },
      evaluateFn: () => {
        throw new Error('should not evaluate');
      },
    });
    expect(result.status).toBe('failed');
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta.failureReason).toBe('stryker_package_unreadable');
  });

  it('fails closed before Stryker when actual Node is not the repository pin', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/models/User.ts', 'export const userModel = 8;\n');
    commitAll(root, 'critical-wrong-node');
    let invokeCount = 0;
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      actualNodeVersion: '20.11.0',
      invokeStrykerFn: () => {
        invokeCount += 1;
        throw new Error('should not invoke Stryker on node pin failure');
      },
      evaluateFn: () => {
        throw new Error('should not evaluate');
      },
    });
    expect(invokeCount).toBe(0);
    expect(result.status).toBe('failed');
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta.failureReason).toBe('node_version_mismatch');
    expect(meta.errorMessage).toMatch(/20\.11\.0.*22\.23\.1/);
  });

  it('fails not_applicable green path on GITHUB_SHA mismatch or dirty relevant state', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'messages/en/common.json', '{"hello":"unrelated-4"}\n');
    commitAll(root, 'unrelated-4');
    const shaMismatch = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv({ GITHUB_SHA: 'f'.repeat(40) }),
      invokeStrykerFn: () => ({
        status: 0,
        signal: null,
        error: undefined,
        stdout: '',
        stderr: '',
      }),
      evaluateFn: () => {
        throw new Error('should not evaluate');
      },
    });
    expect(shaMismatch.status).toBe('failed');
    expect(shaMismatch.evidenceErrors?.join('\n') ?? '').toContain('GITHUB_SHA');
    writeBoundCompletedEvidence(root, { outcome: 'not_applicable', files: [], omitReport: true });
    write(root, 'src/models/User.ts', 'export const userModel = "ci-dirty";\n');
    expect(errorsOf(root, { CI: 'true' })).toMatch(/Dirty|fingerprint|clean relevant/);
  });

  it('fails closed on T0/T1 workspace drift during the run', () => {
    const root = seedMinimalMutationRepo();
    const baseSha = git(root, ['rev-parse', 'HEAD']);
    write(root, 'src/models/User.ts', 'export const userModel = 3;\n');
    commitAll(root, 'critical-user-3');
    const result = executeMutationGate(root, {
      mode: 'changed',
      baseRef: baseSha,
      env: testEnv(),
      invokeStrykerFn: () => {
        write(root, 'src/models/User.ts', 'export const userModel = "drifted";\n');
        writeJsonAtomic(
          path.join(root, 'reports/mutation/mutation.json'),
          baseReport(['src/models/User.ts']),
        );
        return { status: 0, signal: null, error: undefined, stdout: '', stderr: '' };
      },
      evaluateFn: () => {
        throw new Error('should not evaluate after drift');
      },
    });
    expect(result.status).toBe('failed');
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports/mutation/gate-run-meta.json'), 'utf8'),
    );
    expect(meta).toMatchObject({ status: 'failed', failureReason: 'workspace_drift_t0_t1' });
  });
});

describe('workflow and package mutation:gate wiring', () => {
  it('asserts exact local package command and direct CI wrapper wiring', () => {
    const root = process.cwd();
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['mutation:gate']).toBe('node scripts/run-mutation-gate.mjs');
    expect(pkg.scripts['check:mutation-report']).toBe('node scripts/check-mutation-report.mjs');
    expect(pkg.scripts['check:mutation']).toBe('node scripts/check-mutation-report.mjs');
    expect(pkg.scripts['test:mutation']).toBe('npm run mutation:gate -- --mode full');
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('node scripts/run-mutation-gate.mjs --mode full');
    expect(workflow).toContain('node scripts/run-mutation-gate.mjs --mode changed --base-ref');
    expect(workflow).toMatch(
      /0000000000000000000000000000000000000000[\s\S]*node scripts\/run-mutation-gate\.mjs --mode full/,
    );
    expect(workflow).not.toMatch(/npm run mutation:gate/);
    expect(workflow).not.toMatch(/git rev-parse HEAD\^/);
    expect(workflow).not.toMatch(/resolve-mutation-scope\.mjs|MUTATION_SCOPE_PATH/);
    expect(workflow).not.toMatch(/STRYKER_VERSION/);
  });
});
