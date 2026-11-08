import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMutationGate as evaluateMutationEvidence } from './check-mutation-report.mjs';
import {
  CRITICAL_MUTATION_PATTERNS,
  normalizeMutationPath,
  toStrykerMutatePatterns,
} from './mutation-scope.mjs';
import {
  buildToolchainRecord,
  classifyMutationExitDisposition,
  expandFullCriticalInventory,
  EXPECTED_NODE_VERSION,
  EXPECTED_STRYKER_VERSION,
  fingerprintRelevantInputs,
  mutationEvidencePaths,
  removeStaleMutationReport,
  reportTestFilePaths,
  resolveMutationCampaignScope,
  sha256File,
  validateBoundMutationReport,
  validateMutationRunEvidence,
  writeGateRunMeta,
  writeJsonAtomic,
  MUTATION_REPORT_RELATIVE,
  MUTATION_SCOPE_RELATIVE,
  MUTATION_RERUN_MESSAGE,
} from './mutation-run-evidence.mjs';
import {
  mergeMutationShardReports,
  MUTATION_SHARDS_DIR_RELATIVE,
  mutationShardPaths,
  parseMutationShardCount,
  parseMutationShardIndex,
  partitionMutationInventory,
} from './mutation-shards.mjs';

const FULL_DEFAULT_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const CHANGED_DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const SHARD_DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
const MIN_STRYKER_TIMEOUT_MS = 60_000;
const MAX_STRYKER_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;
const DIAGNOSTIC_TAIL_MAX_CHARS = 8 * 1024;

/**
 * Move a file, falling back to copy + remove when source and target sit on
 * different filesystems (EXDEV): the gate mounts the shard cache as its own
 * volume, and rename(2) cannot cross volumes.
 */
export function moveFile(from, to, fs = { renameSync, copyFileSync, rmSync }) {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.copyFileSync(from, to);
    fs.rmSync(from, { force: true });
  }
}

export function parseMutationGateArgs(argv) {
  /** @type {string | null} */
  let modeArg = null;
  /** @type {string | null} */
  let baseRef = null;
  /** @type {number | null} */
  let shards = null;
  /** @type {number | null} */
  let onlyShard = null;
  let mergeShards = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      modeArg = argv[++i] ?? null;
    } else if (arg.startsWith('--mode=')) {
      modeArg = arg.slice('--mode='.length);
    } else if (arg === '--base-ref') {
      baseRef = argv[++i] ?? null;
    } else if (arg.startsWith('--base-ref=')) {
      baseRef = arg.slice('--base-ref='.length);
    } else if (arg === '--shards') {
      shards = parseMutationShardCount(argv[++i]);
    } else if (arg.startsWith('--shards=')) {
      shards = parseMutationShardCount(arg.slice('--shards='.length));
    } else if (arg === '--only-shard') {
      onlyShard = parseMutationShardIndex(argv[++i]);
    } else if (arg.startsWith('--only-shard=')) {
      onlyShard = parseMutationShardIndex(arg.slice('--only-shard='.length));
    } else if (arg === '--merge-shards') {
      mergeShards = true;
    } else {
      throw new Error(`Unknown mutation:gate argument: ${arg}`);
    }
  }
  if (modeArg !== 'changed' && modeArg !== 'full') {
    throw new Error('mutation:gate requires --mode changed|full');
  }
  if (modeArg === 'changed' && (!baseRef || baseRef.length === 0)) {
    throw new Error('mutation:gate --mode changed requires --base-ref REF');
  }
  if ((onlyShard !== null || mergeShards) && modeArg !== 'full') {
    throw new Error('mutation:gate --only-shard and --merge-shards require --mode full');
  }
  if (onlyShard !== null && mergeShards) {
    throw new Error('mutation:gate takes --only-shard or --merge-shards, not both');
  }
  if (onlyShard !== null && shards !== null && onlyShard > shards) {
    throw new Error(`mutation:gate --only-shard ${onlyShard} is outside 1..${shards}`);
  }
  return {
    mode: /** @type {'changed'|'full'} */ (modeArg),
    baseRef: modeArg === 'changed' ? baseRef : null,
    ...(shards === null ? {} : { shards }),
    ...(onlyShard === null ? {} : { onlyShard }),
    ...(mergeShards ? { mergeShards } : {}),
  };
}

/**
 * Shard count for a full campaign: `--shards N` wins, else env MUTATION_SHARDS,
 * else null (single unsharded run, the historical behaviour).
 *
 * @param {number | null | undefined} cliShards
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveMutationShardCount(cliShards, env = process.env) {
  if (cliShards != null) return parseMutationShardCount(cliShards);
  const raw = env.MUTATION_SHARDS;
  return raw === undefined || raw === '' ? null : parseMutationShardCount(raw);
}

/**
 * Per-shard Stryker timeout. Default 60 min; env MUTATION_SHARD_TIMEOUT_MS
 * bounded like MUTATION_STRYKER_TIMEOUT_MS (1m–6h).
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveShardTimeoutMs(env = process.env) {
  const raw = env.MUTATION_SHARD_TIMEOUT_MS;
  if (raw === undefined || raw === '') return SHARD_DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_STRYKER_TIMEOUT_MS ||
    parsed > MAX_STRYKER_TIMEOUT_MS
  ) {
    throw new Error(
      `MUTATION_SHARD_TIMEOUT_MS must be between ${MIN_STRYKER_TIMEOUT_MS} and ${MAX_STRYKER_TIMEOUT_MS} (got ${raw}).`,
    );
  }
  return parsed;
}

/**
 * Operational Stryker timeout only (not an evidence pin).
 * Defaults: full = 3h, changed = 45m. Env override bounded 1m–6h.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {'changed' | 'full'} [mode]
 */
export function resolveStrykerTimeoutMs(env = process.env, mode = 'changed') {
  const raw = env.MUTATION_STRYKER_TIMEOUT_MS;
  if (raw === undefined || raw === '') {
    return mode === 'full' ? FULL_DEFAULT_TIMEOUT_MS : CHANGED_DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_STRYKER_TIMEOUT_MS ||
    parsed > MAX_STRYKER_TIMEOUT_MS
  ) {
    throw new Error(
      `MUTATION_STRYKER_TIMEOUT_MS must be between ${MIN_STRYKER_TIMEOUT_MS} and ${MAX_STRYKER_TIMEOUT_MS} (got ${raw}).`,
    );
  }
  return parsed;
}

/** Local pinned Stryker only: spawnSync(process.execPath,[bin,'run',...],{shell:false}). No npx. */
export function invokeStryker(root, options) {
  const strykerJs = path.join(
    root,
    'node_modules',
    '@stryker-mutator',
    'core',
    'bin',
    'stryker.js',
  );
  if (!existsSync(strykerJs)) {
    const error = new Error(
      `Local Stryker binary missing at ${strykerJs}. Install @stryker-mutator/core@${EXPECTED_STRYKER_VERSION} (npm ci).`,
    );
    return { status: null, signal: null, error, stdout: '', stderr: error.message };
  }
  const args = [strykerJs, 'run'];
  if (options.mutatePatterns?.length) args.push('--mutate', options.mutatePatterns.join(','));
  if (options.incrementalFile) args.push('--incrementalFile', options.incrementalFile);
  const env = { ...(options.env ?? process.env), MUTATION_GATE_MODE: options.mode };
  const timeout =
    options.timeoutMs ?? resolveStrykerTimeoutMs(env, options.mode === 'full' ? 'full' : 'changed');
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: false,
    timeout,
    maxBuffer: DEFAULT_MAX_BUFFER,
  });
  if (result.error) {
    const code = /** @type {NodeJS.ErrnoException} */ (result.error).code;
    if (code === 'ENOBUFS') {
      result.error = new Error(
        `Stryker stdout/stderr exceeded maxBuffer (${DEFAULT_MAX_BUFFER} bytes). Reduce log volume or raise buffer carefully.`,
      );
    } else if (code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
      result.error = new Error(
        `Stryker timed out after ${timeout}ms. Re-run with a bounded MUTATION_STRYKER_TIMEOUT_MS or investigate hung workers.`,
      );
    }
  }
  return {
    status: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function markFailed(root, commonMeta, fields, scope, extra = {}) {
  writeGateRunMeta(root, 'failed', { ...commonMeta, ...fields });
  return {
    status: 'failed',
    exitCode: 1,
    scope,
    evaluation: null,
    ...extra,
  };
}

/**
 * Resolve Node + installed Stryker before any campaign. Fail closed when the
 * actual Node process is not the repository pin, or when local Stryker is
 * missing, unreadable, or version-mismatched.
 *
 * @param {string} root
 * @param {Record<string, unknown>} commonMeta
 * @param {unknown} scope
 * @param {{ actualNodeVersion?: string }} [options]
 */
function resolveCampaignToolchain(root, commonMeta, scope, options = {}) {
  const actualNode = options.actualNodeVersion ?? process.versions.node;
  if (actualNode !== EXPECTED_NODE_VERSION) {
    return {
      ok: false,
      result: markFailed(
        root,
        commonMeta,
        {
          failureReason: 'node_version_mismatch',
          errorMessage: `Actual Node process version ${actualNode} does not match repository pin ${EXPECTED_NODE_VERSION}.`,
        },
        scope,
      ),
    };
  }
  try {
    const toolchain = buildToolchainRecord(root);
    if (toolchain.stryker !== EXPECTED_STRYKER_VERSION) {
      return {
        ok: false,
        result: markFailed(
          root,
          commonMeta,
          {
            failureReason: 'stryker_version_mismatch',
            errorMessage: `Installed Stryker ${toolchain.stryker} does not match repository pin ${EXPECTED_STRYKER_VERSION}.`,
            toolchain,
          },
          scope,
        ),
      };
    }
    return { ok: true, toolchain };
  } catch (error) {
    return {
      ok: false,
      result: markFailed(
        root,
        commonMeta,
        {
          failureReason: 'stryker_package_unreadable',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        scope,
      ),
    };
  }
}

function completeNotApplicable(root, paths, commonMeta, scope, env, toolchain) {
  removeStaleMutationReport(root);
  let fingerprint;
  try {
    fingerprint = fingerprintRelevantInputs(root, { mode: 'changed', sourceInventory: [] });
  } catch (error) {
    return markFailed(
      root,
      commonMeta,
      {
        failureReason: 'not_applicable_fingerprint_failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      scope,
    );
  }
  writeGateRunMeta(root, 'completed', {
    ...commonMeta,
    exitDisposition: 'not_applicable',
    strykerExitCode: 0,
    sourceInventory: [],
    mutateInput: [],
    scopeSha256: sha256File(paths.scopePath),
    reportSha256: null,
    fingerprint,
    fingerprintT0: fingerprint,
    fingerprintT1: fingerprint,
    toolchain,
  });
  const evidenceErrors = validateMutationRunEvidence(root, { env });
  if (evidenceErrors.length > 0) {
    return markFailed(
      root,
      commonMeta,
      {
        failureReason: 'not_applicable_evidence_validation_failed',
        evidenceErrors: evidenceErrors.slice(0, 20),
        errorMessage: evidenceErrors[0],
      },
      scope,
      { evidenceErrors },
    );
  }
  return {
    status: 'completed',
    exitCode: 0,
    scope,
    evaluation: null,
    outcome: 'not_applicable',
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function diagnosticTail(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  return normalized.slice(-DIAGNOSTIC_TAIL_MAX_CHARS);
}

function captureCampaignFingerprint(root, campaignMode, sourceInventory) {
  return fingerprintRelevantInputs(root, { mode: campaignMode, sourceInventory });
}

function loadCampaignReport(reportPath, strykerResult) {
  const diagnostics = {
    strykerExitCode: strykerResult.status,
    strykerStdoutTail: diagnosticTail(strykerResult.stdout),
    strykerStderrTail: diagnosticTail(strykerResult.stderr),
  };
  if (!existsSync(reportPath)) {
    return {
      ok: false,
      fields: {
        failureReason: 'report_missing_after_stryker',
        errorMessage: 'Mutation report missing after Stryker run.',
        ...diagnostics,
      },
    };
  }
  try {
    return { ok: true, report: JSON.parse(readFileSync(reportPath, 'utf8')) };
  } catch (error) {
    return {
      ok: false,
      fields: {
        failureReason: 'report_unreadable',
        errorMessage: errorMessage(error),
        ...diagnostics,
      },
    };
  }
}

function classifyCampaignExit(root, commonMeta, scope, campaignMode, report, strykerExitCode) {
  const expectedFullInventory =
    campaignMode === 'full' ? expandFullCriticalInventory(root) : undefined;
  const structural = validateBoundMutationReport({
    report,
    scope,
    mode: campaignMode,
    headSha: commonMeta.headSha,
    expectedFullInventory,
  });
  const exitDisposition = classifyMutationExitDisposition({
    exitCode: strykerExitCode,
    structural,
    mode: campaignMode,
    report,
  });
  if (exitDisposition === 'failed') {
    return {
      ok: false,
      fields: {
        failureReason: 'materialization_or_hard_failure',
        strykerExitCode,
        structuralErrors: structural.ok === false ? structural.errors : [],
        errorMessage:
          structural.ok === false
            ? structural.errors[0]
            : `Stryker exit ${strykerExitCode} is not an allowed threshold failure.`,
      },
    };
  }
  return { ok: true, exitDisposition };
}

function runStrykerCampaign(
  root,
  paths,
  commonMeta,
  scope,
  campaignMode,
  sourceInventory,
  env,
  invoke,
) {
  const fail = (fields, extra) => ({
    ok: false,
    result: markFailed(root, commonMeta, fields, scope, extra),
  });
  const mutateInput =
    campaignMode === 'changed'
      ? toStrykerMutatePatterns(sourceInventory)
      : [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'];

  let fingerprintT0;
  try {
    fingerprintT0 = captureCampaignFingerprint(root, campaignMode, sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'fingerprint_t0_failed', errorMessage: errorMessage(error) });
  }

  const strykerResult = invoke(root, {
    mode: campaignMode,
    mutatePatterns: campaignMode === 'changed' ? mutateInput : undefined,
    env,
  });
  if (strykerResult.error) {
    return fail({
      failureReason: 'stryker_spawn_failed',
      errorMessage: strykerResult.error.message,
      strykerSignal: strykerResult.signal ?? null,
    });
  }
  // Signal-only death (no exit code, no spawn error): fail closed.
  if (strykerResult.status == null) {
    return fail({
      failureReason: 'stryker_signal_death',
      strykerSignal: strykerResult.signal ?? null,
      errorMessage: `Stryker terminated without an exit code (signal=${
        strykerResult.signal ?? 'none'
      }). Fail closed; no threshold waiver.`,
    });
  }

  let fingerprintT1;
  try {
    fingerprintT1 = captureCampaignFingerprint(root, campaignMode, sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'fingerprint_t1_failed', errorMessage: errorMessage(error) });
  }
  if (
    fingerprintT0.sha256 !== fingerprintT1.sha256 ||
    fingerprintT0.entryCount !== fingerprintT1.entryCount
  ) {
    return fail({ failureReason: 'workspace_drift_t0_t1', fingerprintT0, fingerprintT1 });
  }

  const loaded = loadCampaignReport(paths.reportPath, strykerResult);
  if (loaded.ok === false) return fail(loaded.fields);

  const classified = classifyCampaignExit(
    root,
    commonMeta,
    scope,
    campaignMode,
    loaded.report,
    strykerResult.status,
  );
  if (classified.ok === false) return fail(classified.fields);

  return {
    ok: true,
    mutateInput,
    fingerprintT0,
    fingerprintT1,
    report: loaded.report,
    exitDisposition: classified.exitDisposition,
    strykerExitCode: strykerResult.status,
  };
}

const STRYKER_TIMEOUT_TEXT = 'Stryker timed out after';

/**
 * Run one Stryker invocation for shard k of N. Its report is moved to
 * reports/mutation/shards/<k>-of-<N>.mutation.json; its incremental cache is
 * <k>-of-<N>.incremental.json (Stryker writes it only when the shard ends).
 * A stale shard report from an earlier run is deleted first, so only reports
 * produced by THIS run (this head SHA) can ever be merged.
 *
 * The shard gets min(per-shard timeout, time left before the campaign
 * deadline); with less than MIN_STRYKER_TIMEOUT_MS left it is not started and
 * counts as timed out. Shard runs use Vitest related-test selection
 * (MUTATION_VITEST_RELATED=1, read by stryker.config.mjs) so each one does not
 * pay the whole-corpus dry run; the inventory check below still fails a shard
 * whose report drops a file.
 *
 * @typedef {{
 *   shard: number;
 *   files: number;
 *   reportRelative: string;
 *   incrementalRelative: string;
 *   vitestRelated: boolean;
 *   status: 'empty' | 'completed' | 'failed' | 'timed_out' | 'not_started' | 'missing';
 *   report?: any;
 *   error?: string;
 *   timeoutMs?: number;
 *   durationMs?: number;
 *   strykerExitCode?: number | null;
 *   strykerStderrTail?: string | null;
 * }} MutationShardResult
 * @returns {MutationShardResult}
 */
function runMutationShard(root, paths, shard, shardCount, files, ctx) {
  const shardPaths = mutationShardPaths(shard, shardCount);
  const shardReportPath = path.join(root, shardPaths.reportRelative);
  rmSync(shardReportPath, { force: true });
  removeStaleMutationReport(root);
  const summary = { shard, files: files.length, ...shardPaths, vitestRelated: true };
  if (files.length === 0) return { ...summary, status: 'empty', report: null };
  const remainingMs = ctx.deadline - ctx.now();
  if (remainingMs < MIN_STRYKER_TIMEOUT_MS) {
    return {
      ...summary,
      status: 'not_started',
      error: `${STRYKER_TIMEOUT_TEXT} the ${ctx.budgetMs}ms campaign budget (MUTATION_STRYKER_TIMEOUT_MS) before shard ${shard} of ${shardCount} could start.`,
    };
  }
  const timeoutMs = Math.min(ctx.timeoutMs, remainingMs);
  const startedAt = ctx.now();
  const result = ctx.invoke(root, {
    mode: 'full',
    mutatePatterns: toStrykerMutatePatterns(files),
    incrementalFile: shardPaths.incrementalRelative,
    timeoutMs,
    env: { ...ctx.env, MUTATION_VITEST_RELATED: '1' },
  });
  const timing = {
    ...summary,
    timeoutMs,
    durationMs: ctx.now() - startedAt,
    strykerExitCode: result.status,
  };
  if (result.error) {
    const timedOut = result.error.message.includes(STRYKER_TIMEOUT_TEXT);
    return { ...timing, status: timedOut ? 'timed_out' : 'failed', error: result.error.message };
  }
  if (result.status !== 0 || !existsSync(paths.reportPath)) {
    const exit = result.status ?? `signal ${result.signal ?? 'none'}`;
    return {
      ...timing,
      status: 'failed',
      error: `Stryker exit ${exit}${existsSync(paths.reportPath) ? '' : ', no report'}.`,
      strykerStderrTail: diagnosticTail(result.stderr),
    };
  }
  moveFile(paths.reportPath, shardReportPath);
  try {
    const report = JSON.parse(readFileSync(shardReportPath, 'utf8'));
    const reported = Object.keys(report?.files ?? {})
      .map(normalizeMutationPath)
      .sort();
    if (reported.length !== files.length || reported.some((file, i) => file !== files[i])) {
      return { ...timing, status: 'failed', error: 'Shard report files do not match its shard.' };
    }
    return { ...timing, status: 'completed', report };
  } catch (error) {
    return { ...timing, status: 'failed', error: errorMessage(error) };
  }
}

/** A shard killed by its timeout, or never started because the campaign budget ran out. */
const isTimeoutClass = (result) => result.status === 'timed_out' || result.status === 'not_started';

/** Shard summaries for gate-run-meta; timeout text stays out unless every failure is a timeout. */
function shardMetaSummary(results, keepTimeoutText) {
  return results.map(({ report: _report, error, ...rest }) =>
    error && (keepTimeoutText || !isTimeoutClass(rest)) ? { ...rest, error } : rest,
  );
}

/**
 * Full campaign split into N hash-partitioned shards, run in sequence. A
 * timed-out or failed shard does not stop later shards (their caches still
 * get written). Only when every shard completed in this run is a merged
 * report written to reports/mutation/mutation.json for the unchanged
 * full-mode evidence path. Timeouts (and nothing worse) keep the
 * "Stryker timed out after" text in gate-run-meta so the gate reports
 * MUTATION UNVERIFIED; any other shard failure fails closed.
 *
 * MUTATION_STRYKER_TIMEOUT_MS (the gate's 150 min) is the deadline for the
 * whole campaign, so N shards never outlive the gate job's own kill: a job
 * killed mid-shard writes no gate-run-meta and goes red instead of UNVERIFIED.
 */
function runShardedStrykerCampaign(root, paths, commonMeta, scope, sourceInventory, ctx) {
  const fail = (fields) => ({ ok: false, result: markFailed(root, commonMeta, fields, scope) });
  const { shardCount } = ctx;
  const now = ctx.now ?? Date.now;
  const campaignStart = now();
  let setup;
  try {
    setup = shardCampaignSetup(root, ctx.env, sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'shard_setup_failed', errorMessage: errorMessage(error) });
  }
  const { timeoutMs, budgetMs, fingerprintT0 } = setup;
  mkdirSync(path.join(root, MUTATION_SHARDS_DIR_RELATIVE), { recursive: true });
  const results = partitionMutationInventory(sourceInventory, shardCount).map((files, index) =>
    runMutationShard(root, paths, index + 1, shardCount, files, {
      ...ctx,
      now,
      timeoutMs,
      budgetMs,
      deadline: campaignStart + budgetMs,
    }),
  );

  let fingerprintT1;
  try {
    fingerprintT1 = captureCampaignFingerprint(root, 'full', sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'fingerprint_t1_failed', errorMessage: errorMessage(error) });
  }
  if (
    fingerprintT0.sha256 !== fingerprintT1.sha256 ||
    fingerprintT0.entryCount !== fingerprintT1.entryCount
  ) {
    return fail({ failureReason: 'workspace_drift_t0_t1', fingerprintT0, fingerprintT1 });
  }

  const judged = judgeShardResults(root, paths, commonMeta, scope, shardCount, results);
  return judged.ok ? { ...judged, fingerprintT0, fingerprintT1 } : judged;
}

/**
 * Verdict over the N shard results of one head SHA (all run in this process,
 * or all read back by --merge-shards). A hard failure fails closed; a missing
 * shard says so and claims no score; timeouts alone keep the "Stryker timed
 * out after" text (MUTATION UNVERIFIED). Only N finished shards are merged
 * into reports/mutation/mutation.json and classified like an unsharded run.
 *
 * @param {MutationShardResult[]} results
 */
function judgeShardResults(root, paths, commonMeta, scope, shardCount, results) {
  const fail = (fields) => ({ ok: false, result: markFailed(root, commonMeta, fields, scope) });
  const mutateInput = [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'];
  const hardFailure = results.find((r) => r.status === 'failed');
  if (hardFailure) {
    return fail({
      failureReason: 'shard_failed',
      errorMessage: `Mutation shard ${hardFailure.shard} of ${shardCount} failed: ${hardFailure.error}`,
      shards: shardMetaSummary(results, false),
    });
  }
  const missing = results.filter((r) => r.status === 'missing');
  const unfinished = results.filter((r) => r.status === 'missing' || isTimeoutClass(r));
  if (missing.length > 0) {
    const which = missing.map((r) => `shard ${r.shard} (${r.error})`).join('; ');
    return fail({
      failureReason: 'shard_missing',
      errorMessage: `${unfinished.length} of ${shardCount} mutation shards did not finish: ${which}. No merged score for this run; run the missing shards with --only-shard <k> on this head, then --merge-shards.`,
      shards: shardMetaSummary(results, false),
    });
  }
  if (unfinished.length > 0) {
    return fail({
      failureReason: 'stryker_spawn_failed',
      errorMessage: `${unfinished.length} of ${shardCount} mutation shards did not finish: ${unfinished[0].error} No merged score for this run; finished shards kept their incremental cache.`,
      shards: shardMetaSummary(results, true),
    });
  }

  let report;
  try {
    report = mergeMutationShardReports(
      results.filter((r) => r.status === 'completed'),
      mutateInput,
    );
    writeJsonAtomic(paths.reportPath, report);
  } catch (error) {
    return fail({ failureReason: 'shard_merge_failed', errorMessage: errorMessage(error) });
  }
  const classified = classifyCampaignExit(root, commonMeta, scope, 'full', report, 0);
  if (classified.ok === false) return fail(classified.fields);
  return {
    ok: true,
    mutateInput,
    report,
    exitDisposition: classified.exitDisposition,
    strykerExitCode: 0,
    shards: shardMetaSummary(results, false),
  };
}

/** Per-shard and campaign timeouts plus the T0 fingerprint; throws on bad env. */
function shardCampaignSetup(root, env, sourceInventory) {
  return {
    timeoutMs: resolveShardTimeoutMs(env),
    budgetMs: resolveStrykerTimeoutMs(env, 'full'),
    fingerprintT0: captureCampaignFingerprint(root, 'full', sourceInventory),
  };
}

const SHARD_META_SCHEMA_VERSION = 1;

/**
 * `--only-shard k`: run shard k of N alone (one gate job per shard, so the
 * gate can hand the lane to a waiting PR between shards, RIN-1110). Writes the
 * shard report and incremental cache as the in-process sharded run does, plus
 * <k>-of-<N>.meta.json binding the result to this head SHA, the inputs
 * fingerprint and the toolchain. No score: --merge-shards merges and judges.
 * Exit 0 when the shard completed (or has no files); a timeout keeps the
 * "Stryker timed out after" text so the gate reports UNVERIFIED; anything
 * else fails closed.
 */
function runSingleShardJob(root, paths, commonMeta, scope, sourceInventory, ctx) {
  const fail = (fields) => markFailed(root, commonMeta, fields, scope);
  const { shardCount, onlyShard: shard } = ctx;
  const metaPath = path.join(root, mutationShardPaths(shard, shardCount).metaRelative);
  rmSync(metaPath, { force: true });
  const now = ctx.now ?? Date.now;
  const campaignStart = now();
  let setup;
  try {
    setup = shardCampaignSetup(root, ctx.env, sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'shard_setup_failed', errorMessage: errorMessage(error) });
  }
  mkdirSync(path.join(root, MUTATION_SHARDS_DIR_RELATIVE), { recursive: true });
  const files = partitionMutationInventory(sourceInventory, shardCount)[shard - 1] ?? [];
  let result = runMutationShard(root, paths, shard, shardCount, files, {
    ...ctx,
    now,
    timeoutMs: setup.timeoutMs,
    budgetMs: setup.budgetMs,
    deadline: campaignStart + setup.budgetMs,
  });

  let fingerprintT1;
  try {
    fingerprintT1 = captureCampaignFingerprint(root, 'full', sourceInventory);
  } catch (error) {
    return fail({ failureReason: 'fingerprint_t1_failed', errorMessage: errorMessage(error) });
  }
  const drifted = !sameFingerprint(setup.fingerprintT0, fingerprintT1);
  if (drifted) {
    result = { ...result, status: 'failed', error: 'Workspace inputs changed during the shard.' };
  }
  const [summary] = shardMetaSummary([result], true);
  writeJsonAtomic(metaPath, {
    ...summary,
    schemaVersion: SHARD_META_SCHEMA_VERSION,
    shardCount,
    headSha: commonMeta.headSha,
    sourceFiles: files,
    fingerprintT0: setup.fingerprintT0,
    fingerprintT1,
    toolchain: ctx.toolchain,
    finishedAt: new Date().toISOString(),
  });

  const shardLabel = `Mutation shard ${shard} of ${shardCount}`;
  if (drifted) {
    return fail({
      failureReason: 'workspace_drift_t0_t1',
      fingerprintT0: setup.fingerprintT0,
      fingerprintT1,
      shards: [summary],
    });
  }
  if (isTimeoutClass(result)) {
    return fail({
      failureReason: 'stryker_spawn_failed',
      errorMessage: `${shardLabel} did not finish: ${result.error} No score for this shard.`,
      shards: [summary],
    });
  }
  if (result.status === 'failed') {
    return fail({
      failureReason: 'shard_failed',
      errorMessage: `${shardLabel} failed: ${result.error}`,
      shards: [summary],
    });
  }
  return {
    status: 'completed',
    exitCode: 0,
    scope,
    evaluation: null,
    outcome: 'shard_completed',
    shard: summary,
  };
}

/** Statuses a single-shard job can record (never 'missing'). */
const SHARD_JOB_STATUSES = new Set(['completed', 'empty', 'failed', 'timed_out', 'not_started']);
const sameFingerprint = (a, b) => a?.sha256 === b?.sha256 && a?.entryCount === b?.entryCount;
const sameFileList = (a, b) =>
  Array.isArray(a) && a.length === b.length && a.every((file, i) => file === b[i]);

/**
 * Read back what `--only-shard k` left for shard k on this head SHA. A result
 * from another head (an older night on the persisted shard volume) or no
 * result at all is 'missing'; a result whose inputs, toolchain or file list
 * differ from this checkout fails closed.
 *
 * @returns {MutationShardResult}
 */
function loadShardResult(root, shard, shardCount, files, expected) {
  const shardPaths = mutationShardPaths(shard, shardCount);
  const summary = { shard, files: files.length, ...shardPaths, vitestRelated: true };
  /** @param {string} error @returns {MutationShardResult} */
  const failed = (error) => ({ ...summary, status: 'failed', error });
  let meta;
  try {
    meta = JSON.parse(readFileSync(path.join(root, shardPaths.metaRelative), 'utf8'));
  } catch {
    return { ...summary, status: 'missing', error: 'no shard result' };
  }
  if (meta?.headSha !== expected.headSha) {
    const other = String(meta?.headSha).slice(0, 12);
    return { ...summary, status: 'missing', error: `result is for head ${other}, not this head` };
  }
  if (meta.schemaVersion !== SHARD_META_SCHEMA_VERSION || meta.shardCount !== shardCount) {
    return failed('Shard result has an unexpected schema or shard count.');
  }
  if (!sameFileList(meta.sourceFiles, files)) {
    return failed('Shard result covers a different file list than this shard.');
  }
  if (!sameFingerprint(meta.fingerprintT1, expected.fingerprint)) {
    return failed('Shard ran on different inputs than this checkout (fingerprint mismatch).');
  }
  if (JSON.stringify(meta.toolchain) !== JSON.stringify(expected.toolchain)) {
    return failed('Shard ran with a different Node/Stryker toolchain.');
  }
  const { status, error, timeoutMs, durationMs, strykerExitCode } = meta;
  if (!SHARD_JOB_STATUSES.has(status)) return failed(`Shard result has unknown status ${status}.`);
  /** @type {MutationShardResult} */
  const recorded = { ...summary, status, error, timeoutMs, durationMs, strykerExitCode };
  if (status !== 'completed') return recorded;
  try {
    const report = JSON.parse(readFileSync(path.join(root, shardPaths.reportRelative), 'utf8'));
    const reported = Object.keys(report?.files ?? {})
      .map(normalizeMutationPath)
      .sort();
    if (!sameFileList(reported, files)) return failed('Shard report files do not match its shard.');
    return { ...recorded, report };
  } catch (readError) {
    return failed(`Shard report unreadable: ${errorMessage(readError)}`);
  }
}

/**
 * `--merge-shards`: after the N `--only-shard` jobs on this head, merge their
 * reports and judge them exactly like the in-process sharded run.
 */
function mergeShardJobResults(root, paths, commonMeta, scope, sourceInventory, ctx) {
  let fingerprint;
  try {
    fingerprint = captureCampaignFingerprint(root, 'full', sourceInventory);
  } catch (error) {
    const fields = { failureReason: 'fingerprint_t1_failed', errorMessage: errorMessage(error) };
    return { ok: false, result: markFailed(root, commonMeta, fields, scope) };
  }
  const expected = { headSha: commonMeta.headSha, fingerprint, toolchain: ctx.toolchain };
  const results = partitionMutationInventory(sourceInventory, ctx.shardCount).map((files, index) =>
    loadShardResult(root, index + 1, ctx.shardCount, files, expected),
  );
  const judged = judgeShardResults(root, paths, commonMeta, scope, ctx.shardCount, results);
  return judged.ok ? { ...judged, fingerprintT0: fingerprint, fingerprintT1: fingerprint } : judged;
}

/** Why a --only-shard / --merge-shards job cannot run here, or null. */
function shardJobInvalidReason(campaignMode, shardCount, onlyShard) {
  if (campaignMode !== 'full') return 'Shard jobs need a full campaign (--mode full).';
  if (!shardCount) return 'Shard jobs need a shard count: --shards N or MUTATION_SHARDS.';
  if (onlyShard != null && onlyShard > shardCount) {
    return `--only-shard ${onlyShard} is outside 1..${shardCount}.`;
  }
  return null;
}

export function executeMutationGate(root, options) {
  const env = options.env ?? process.env;
  const invoke = options.invokeStrykerFn ?? invokeStryker;
  const evaluate = options.evaluateFn ?? evaluateMutationEvidence;
  const actualNodeVersion = options.actualNodeVersion;
  const paths = mutationEvidencePaths(root);
  const { scope, headSha } = resolveMutationCampaignScope(root, {
    requestedMode: options.mode,
    baseRef: options.baseRef,
  });
  const commonMeta = {
    requestedMode: options.mode,
    mode: scope.mode,
    outcome: scope.outcome,
    baseRef: scope.baseRef,
    baseSha: scope.baseSha,
    headSha,
    scopeRelative: MUTATION_SCOPE_RELATIVE,
    reportRelative: MUTATION_REPORT_RELATIVE,
    upgradeReason: scope.upgradeReason ?? null,
  };
  writeGateRunMeta(root, 'started', commonMeta);
  writeJsonAtomic(paths.scopePath, scope);

  const toolchainResult = resolveCampaignToolchain(
    root,
    commonMeta,
    scope,
    actualNodeVersion === undefined ? {} : { actualNodeVersion },
  );
  if (toolchainResult.ok === false) return toolchainResult.result;
  const { toolchain } = toolchainResult;

  if (scope.outcome === 'not_applicable') {
    return completeNotApplicable(root, paths, commonMeta, scope, env, toolchain);
  }

  const campaignMode = scope.mode === 'full' ? 'full' : 'changed';
  const sourceInventory =
    campaignMode === 'changed' ? [...scope.files] : expandFullCriticalInventory(root);

  let shardCount;
  try {
    shardCount = campaignMode === 'full' ? resolveMutationShardCount(options.shards, env) : null;
  } catch (error) {
    return markFailed(
      root,
      commonMeta,
      { failureReason: 'shard_count_invalid', errorMessage: errorMessage(error) },
      scope,
    );
  }
  const shardJob = options.onlyShard != null ? 'only' : options.mergeShards ? 'merge' : null;
  const invalidShardJob = shardJob
    ? shardJobInvalidReason(campaignMode, shardCount, options.onlyShard)
    : null;
  if (invalidShardJob) {
    return markFailed(
      root,
      commonMeta,
      { failureReason: 'shard_job_invalid', errorMessage: invalidShardJob },
      scope,
    );
  }
  const shardCtx = { env, invoke, shardCount, now: options.now, toolchain };
  if (shardJob === 'only') {
    return runSingleShardJob(root, paths, commonMeta, scope, sourceInventory, {
      ...shardCtx,
      onlyShard: options.onlyShard,
    });
  }
  const campaign = shardJob
    ? mergeShardJobResults(root, paths, commonMeta, scope, sourceInventory, shardCtx)
    : shardCount
      ? runShardedStrykerCampaign(root, paths, commonMeta, scope, sourceInventory, shardCtx)
      : runStrykerCampaign(
          root,
          paths,
          commonMeta,
          scope,
          campaignMode,
          sourceInventory,
          env,
          invoke,
        );
  if (campaign.ok === false) return campaign.result;

  const fingerprint = fingerprintRelevantInputs(root, {
    mode: campaignMode,
    sourceInventory,
    reportTestFiles: reportTestFilePaths(campaign.report),
  });
  writeGateRunMeta(root, 'completed', {
    ...commonMeta,
    exitDisposition: campaign.exitDisposition,
    strykerExitCode: campaign.strykerExitCode,
    sourceInventory,
    mutateInput: campaign.mutateInput,
    fullPatterns: campaignMode === 'full' ? [...CRITICAL_MUTATION_PATTERNS] : null,
    scopeSha256: sha256File(paths.scopePath),
    reportSha256: sha256File(paths.reportPath),
    fingerprint,
    fingerprintT0: campaign.fingerprintT0,
    fingerprintT1: campaign.fingerprintT1,
    toolchain,
    ...(campaign.shards ? { shards: campaign.shards } : {}),
  });
  const evaluation = evaluate(root, { env });
  return {
    status: 'completed',
    exitCode: evaluation.errors.length > 0 ? 1 : 0,
    scope,
    evaluation,
    outcome: 'mutation_required',
    exitDisposition: campaign.exitDisposition,
  };
}

/** Echo the failure diagnostics into the step log so triage never needs the workspace volume. */
function printFailureMeta(root) {
  try {
    const meta = JSON.parse(
      readFileSync(path.join(root, 'reports', 'mutation', 'gate-run-meta.json'), 'utf8'),
    );
    const keys = [
      'failureReason',
      'errorMessage',
      'strykerExitCode',
      'strykerStderrTail',
      'strykerStdoutTail',
    ];
    for (const key of keys) {
      if (meta[key] !== undefined && meta[key] !== null)
        console.error(`gate-run-meta ${key}: ${meta[key]}`);
    }
  } catch {
    console.error('gate-run-meta.json unreadable; no diagnostics to echo.');
  }
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  try {
    const parsed = parseMutationGateArgs(process.argv.slice(2));
    const result = executeMutationGate(process.cwd(), {
      mode: parsed.mode,
      baseRef: parsed.baseRef,
      shards: parsed.shards,
      onlyShard: parsed.onlyShard,
      mergeShards: parsed.mergeShards,
    });
    if (result.outcome === 'shard_completed') {
      const { shard, status, files } = result.shard;
      process.stdout.write(
        `Mutation shard ${shard} ${status} (${files} files); no score until --merge-shards.\n`,
      );
    } else if (result.outcome === 'not_applicable') {
      process.stdout.write(
        'Mutation gate completed: not_applicable (no critical production mutation required; no score claimed).\n',
      );
    } else if (result.evaluation?.errors.length) {
      console.error('Mutation gate evaluation failed:');
      for (const error of result.evaluation.errors) console.error(`- ${error}`);
    } else if (result.evaluation) {
      process.stdout.write(
        `Mutation gate passed: ${result.evaluation.score.toFixed(2)}% (${result.evaluation.detected}/${result.evaluation.valid}).\n`,
      );
    } else if (result.status === 'failed') {
      console.error(
        `Mutation gate failed before evaluation (see gate-run-meta.json). ${MUTATION_RERUN_MESSAGE}`,
      );
      printFailureMeta(process.cwd());
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`Mutation gate failed closed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
