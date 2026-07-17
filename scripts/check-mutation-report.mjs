import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_MUTATION_PATTERNS, normalizeMutationPath } from './mutation-scope.mjs';
import {
  CHANGED_MUTATION_BREAK_THRESHOLD,
  EXPECTED_STRYKER_VERSION,
  MUTATION_RERUN_MESSAGE,
  mutationEvidencePaths,
  validateMutationRunEvidence,
} from './mutation-run-evidence.mjs';

const VALID_STATUSES = new Set(['Killed', 'Survived', 'NoCoverage', 'Timeout']);
const DETECTED_STATUSES = new Set(['Killed', 'Timeout']);
const ERROR_STATUSES = new Set(['Pending', 'RuntimeError', 'CompileError']);
const CANONICAL_BASELINE_RELATIVE = 'quality/mutation-baseline.json';
const CANONICAL_WAIVERS_RELATIVE = 'quality/mutation-waivers.json';

export function mutationFingerprint(file, mutant) {
  const payload = JSON.stringify({
    file,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement,
    location: mutant.location,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function flattenMutants(report) {
  return Object.entries(report?.files ?? {}).flatMap(([file, details]) =>
    (details.mutants ?? []).map((mutant) => ({ ...mutant, file })),
  );
}

export function validateMutationSourceEvidence({ report, root = process.cwd() }) {
  const errors = [];

  for (const [file, details] of Object.entries(report?.files ?? {})) {
    const sourcePath = path.isAbsolute(file) ? file : path.join(root, file);
    if (!existsSync(sourcePath)) {
      errors.push(`${file}: mutated source file is missing.`);
      continue;
    }
    if (typeof details?.source !== 'string') {
      errors.push(`${file}: mutation report is missing the original source content.`);
      continue;
    }
    if (readFileSync(sourcePath, 'utf8') !== details.source) {
      errors.push(`${file}: mutation report source does not match the current file.`);
    }
  }

  return errors;
}

function equalStringArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function expectedFullMutationInput() {
  return [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'];
}

function activeWaivers(registry, toolVersion, now, errors) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.waivers)) {
    errors.push('Mutation waiver registry is invalid.');
    return new Map();
  }

  const waivers = new Map();
  for (const waiver of registry.waivers) {
    if (!/^[a-f0-9]{64}$/.test(waiver.fingerprint ?? '')) {
      errors.push(`${waiver.id ?? 'unknown waiver'}: invalid mutant fingerprint.`);
      continue;
    }
    if (waivers.has(waiver.fingerprint)) {
      errors.push(`${waiver.id}: duplicate mutant fingerprint.`);
    }
    if (waiver.toolVersion !== toolVersion) {
      errors.push(`${waiver.id}: waiver toolVersion does not match the report.`);
    }
    if (typeof waiver.reason !== 'string' || waiver.reason.trim().length < 20) {
      errors.push(`${waiver.id}: waiver reason must be specific.`);
    }
    if (typeof waiver.owner !== 'string' || waiver.owner.trim().length === 0) {
      errors.push(`${waiver.id}: waiver owner is required.`);
    }
    const expiresAt = new Date(waiver.expiresAt);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= now) {
      errors.push(`${waiver.id}: waiver is expired or has invalid expiresAt.`);
    }
    waivers.set(waiver.fingerprint, waiver);
  }
  return waivers;
}

function validateFullBaseline(baseline, toolVersion, errors) {
  if (baseline?.schemaVersion !== 1) {
    errors.push('Full mutation baseline schemaVersion must be 1.');
    return false;
  }
  if (baseline.toolVersion !== toolVersion) {
    errors.push('Full mutation baseline toolVersion does not match the report.');
  }
  if (!equalStringArrays(baseline.scopePatterns ?? [], CRITICAL_MUTATION_PATTERNS)) {
    errors.push('Full mutation baseline scope does not match the production policy.');
  }

  const metrics = ['valid', 'detected', 'survived', 'noCoverage'];
  for (const metric of metrics) {
    if (!Number.isInteger(baseline[metric]) || baseline[metric] < 0) {
      errors.push(`Full mutation baseline ${metric} must be a non-negative integer.`);
    }
  }
  if (
    metrics.every((metric) => Number.isInteger(baseline[metric])) &&
    baseline.detected + baseline.survived + baseline.noCoverage !== baseline.valid
  ) {
    errors.push('Full mutation baseline counts are internally inconsistent.');
  }

  const expectedScore = baseline.valid === 0 ? 0 : (baseline.detected / baseline.valid) * 100;
  if (
    typeof baseline.score !== 'number' ||
    !Number.isFinite(baseline.score) ||
    Math.abs(baseline.score - expectedScore) > 1e-6
  ) {
    errors.push('Full mutation baseline score does not match its counts.');
  }
  return errors.length === 0;
}

export function evaluateMutationReport({
  report,
  registry,
  baseline = /** @type {any} */ (undefined),
  mode = 'full',
  now = new Date(),
  toolVersion,
}) {
  const errors = [];
  if (!['changed', 'full'].includes(mode)) errors.push(`Unsupported mutation gate mode: ${mode}.`);
  if (report?.schemaVersion !== '1.0') {
    errors.push('Stryker mutation report schemaVersion must be 1.0.');
  }
  if (!toolVersion) errors.push('Stryker tool version is missing from the gate input.');
  if (report?.framework?.name !== 'StrykerJS') {
    errors.push('Mutation report framework must be StrykerJS.');
  }
  if (toolVersion && report?.framework?.version !== toolVersion) {
    errors.push('Mutation report StrykerJS version does not match the gate version.');
  }

  const mutants = flattenMutants(report);
  const waivers = activeWaivers(registry, toolVersion, now, errors);
  const fingerprints = new Set(mutants.map((mutant) => mutationFingerprint(mutant.file, mutant)));
  for (const [fingerprint, waiver] of waivers) {
    if (!fingerprints.has(fingerprint))
      errors.push(`${waiver.id}: stale waiver has no report mutant.`);
  }

  const unwaived = mutants.filter(
    (mutant) => !waivers.has(mutationFingerprint(mutant.file, mutant)),
  );
  for (const mutant of unwaived) {
    if (ERROR_STATUSES.has(mutant.status) || !VALID_STATUSES.has(mutant.status)) {
      errors.push(`${mutant.file}#${mutant.id}: invalid terminal status ${mutant.status}.`);
    }
  }

  const valid = unwaived.filter((mutant) => VALID_STATUSES.has(mutant.status));
  const detected = valid.filter((mutant) => DETECTED_STATUSES.has(mutant.status));
  const survived = valid.filter((mutant) => mutant.status === 'Survived');
  const noCoverage = valid.filter((mutant) => mutant.status === 'NoCoverage');
  const score = valid.length === 0 ? 0 : (detected.length / valid.length) * 100;

  if (valid.length === 0) errors.push('Mutation report has zero valid, unwaived mutants.');
  if (mode === 'changed' && valid.length < 20) {
    if (survived.length > 0 || noCoverage.length > 0) {
      errors.push(
        `Changed critical scope has ${valid.length} mutants; all must be detected when fewer than 20 exist.`,
      );
    }
  } else if (mode === 'changed' && score + Number.EPSILON < 80) {
    errors.push(`Mutation score ${score.toFixed(2)}% is below the 80% break threshold.`);
  }

  if (mode === 'full') {
    if (score + Number.EPSILON < CHANGED_MUTATION_BREAK_THRESHOLD) {
      errors.push(
        `Full mutation score ${score.toFixed(2)}% is below the ${CHANGED_MUTATION_BREAK_THRESHOLD}% production threshold.`,
      );
    }

    const reportMutate = Array.isArray(report?.config?.mutate)
      ? report.config.mutate.map(normalizeMutationPath)
      : [];
    if (!equalStringArrays(reportMutate, expectedFullMutationInput())) {
      errors.push('Full mutation report input does not match the production policy.');
    }

    const baselineErrors = [];
    if (validateFullBaseline(baseline, toolVersion, baselineErrors)) {
      if (score + Number.EPSILON < baseline.score) {
        errors.push(
          `Full mutation score ${score.toFixed(6)}% regressed below baseline ${baseline.score.toFixed(6)}%.`,
        );
      }
      if (survived.length > baseline.survived) {
        errors.push(
          `Full mutation Survived debt increased from ${baseline.survived} to ${survived.length}.`,
        );
      }
      if (noCoverage.length > baseline.noCoverage) {
        errors.push(
          `Full mutation NoCoverage debt increased from ${baseline.noCoverage} to ${noCoverage.length}.`,
        );
      }
    } else {
      errors.push(...baselineErrors);
    }
  }

  return {
    errors,
    score,
    valid: valid.length,
    detected: detected.length,
    survived: survived.length,
    noCoverage: noCoverage.length,
    belowHighWatermark: score < 85,
  };
}

/**
 * Authoritative gate evaluation: require completed gate-run-meta.json, then score/waiver checks.
 * Always loads the canonical repository baseline and live waiver paths (no env path steering).
 * Production default for env is process.env; tests may pass a hermetic env bag.
 *
 * @param {string} [root]
 * @param {{ env?: NodeJS.ProcessEnv, actualNodeVersion?: string }} [options]
 */
export function runMutationGate(root = process.cwd(), options = {}) {
  const env = options.env ?? process.env;
  const evidenceOptions =
    options.actualNodeVersion === undefined
      ? { env }
      : { env, actualNodeVersion: options.actualNodeVersion };
  const evidenceErrors = validateMutationRunEvidence(root, evidenceOptions);
  if (evidenceErrors.length > 0) {
    return {
      errors: evidenceErrors,
      score: 0,
      valid: 0,
      detected: 0,
      survived: 0,
      noCoverage: 0,
      belowHighWatermark: true,
      outcome: null,
    };
  }

  const { metaPath, reportPath } = mutationEvidencePaths(root);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

  if (meta.outcome === 'not_applicable') {
    return {
      errors: [],
      score: 0,
      valid: 0,
      detected: 0,
      survived: 0,
      noCoverage: 0,
      belowHighWatermark: false,
      outcome: 'not_applicable',
    };
  }

  if (!existsSync(reportPath)) {
    throw new Error(`Mutation report is missing: ${reportPath}. ${MUTATION_RERUN_MESSAGE}`);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const registry = JSON.parse(readFileSync(path.join(root, CANONICAL_WAIVERS_RELATIVE), 'utf8'));
  const baselinePath = path.join(root, CANONICAL_BASELINE_RELATIVE);
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : undefined;

  // Repository Stryker contract only — never process.env.STRYKER_VERSION.
  // Structural scope/report binding already ran inside validateMutationRunEvidence.
  const mode = meta.mode;
  const result = evaluateMutationReport({
    report,
    registry,
    baseline,
    mode,
    toolVersion: EXPECTED_STRYKER_VERSION,
  });
  result.errors.unshift(...validateMutationSourceEvidence({ report, root }));
  result.outcome = meta.outcome;
  return result;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  try {
    const result = runMutationGate();
    if (result.errors.length > 0) {
      console.error('Mutation gate failed:');
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else if (result.outcome === 'not_applicable') {
      process.stdout.write(
        'Mutation gate passed: not_applicable (no critical production mutation score claimed).\n',
      );
    } else {
      process.stdout.write(
        `Mutation gate passed: ${result.score.toFixed(2)}% (${result.detected}/${result.valid}).\n`,
      );
      if (result.belowHighWatermark) {
        console.warn('Mutation score is below the 85% high watermark.');
      }
    }
  } catch (error) {
    console.error(`Mutation gate failed closed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
