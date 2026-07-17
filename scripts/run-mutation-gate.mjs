import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMutationGate as evaluateMutationEvidence } from './check-mutation-report.mjs';
import { CRITICAL_MUTATION_PATTERNS, toStrykerMutatePatterns } from './mutation-scope.mjs';
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

const FULL_DEFAULT_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const CHANGED_DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const MIN_STRYKER_TIMEOUT_MS = 60_000;
const MAX_STRYKER_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

export function parseMutationGateArgs(argv) {
  /** @type {string | null} */
  let modeArg = null;
  /** @type {string | null} */
  let baseRef = null;
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
  return {
    mode: /** @type {'changed'|'full'} */ (modeArg),
    baseRef: modeArg === 'changed' ? baseRef : null,
  };
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
  const env = { ...(options.env ?? process.env), MUTATION_GATE_MODE: options.mode };
  const timeout = resolveStrykerTimeoutMs(env, options.mode === 'full' ? 'full' : 'changed');
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

function captureCampaignFingerprint(root, campaignMode, sourceInventory) {
  return fingerprintRelevantInputs(root, { mode: campaignMode, sourceInventory });
}

function loadCampaignReport(reportPath, strykerExitCode) {
  if (!existsSync(reportPath)) {
    return {
      ok: false,
      fields: {
        failureReason: 'report_missing_after_stryker',
        strykerExitCode,
        errorMessage: 'Mutation report missing after Stryker run.',
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
        strykerExitCode,
        errorMessage: errorMessage(error),
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

  const loaded = loadCampaignReport(paths.reportPath, strykerResult.status);
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

  const campaign = runStrykerCampaign(
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

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  try {
    const parsed = parseMutationGateArgs(process.argv.slice(2));
    const result = executeMutationGate(process.cwd(), {
      mode: parsed.mode,
      baseRef: parsed.baseRef,
    });
    if (result.outcome === 'not_applicable') {
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
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`Mutation gate failed closed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
