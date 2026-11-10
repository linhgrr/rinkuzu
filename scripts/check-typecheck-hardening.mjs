#!/usr/bin/env node
/**
 * Ratchet for the two strict flags the codebase has not adopted yet.
 *
 * tsconfig.hardening.json turns on noUncheckedIndexedAccess and
 * exactOptionalPropertyTypes. `npm run typecheck:hardening` has existed for a
 * while and was wired into nothing -- no CI step, no hook -- so the count of
 * files that fail under those flags drifted with nobody watching.
 *
 * This does not demand the flags pass. It freezes the set of files that fail
 * and refuses to let it grow, and it refuses just as loudly when a listed file
 * stops failing without being removed from the list: a baseline nobody prunes
 * is a baseline nobody believes. The end state is an empty list, at which point
 * the flags move into tsconfig.json and this script goes away.
 *
 * "No file fails" is believed only from a tsc run that finished. A crashed,
 * killed or out-of-memory tsc prints no diagnostics either, and reading that as
 * "every file now passes" turned master red twice (RIN-1385, RIN-1395). So the
 * check runs without incremental buildinfo, and a run that did not complete
 * fails as incomplete and shows tsc's own output instead (RIN-1389).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'quality', 'typecheck-hardening-baseline.json');

/** tsc reports `path/to/file.ts(12,34): error TS2532: ...`. */
const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;
/** tsc exits 1 or 2 when it finished and reported diagnostics. */
const DIAGNOSTIC_EXIT_CODES = new Set([1, 2]);
const OUTPUT_TAIL_LINES = 40;
const BASELINE_HINT = 'quality/typecheck-hardening-baseline.json';

/**
 * @typedef {object} TscRun
 * @property {number | null} status
 * @property {string | null} signal
 * @property {string} stdout
 * @property {string} stderr
 * @property {Error} [error] set when tsc could not be started or was cut off
 */

/**
 * @typedef {object} HardeningVerdict
 * @property {boolean} ok
 * @property {'incomplete' | 'holds' | 'drift'} outcome
 * @property {string[]} added
 * @property {string[]} resolved
 * @property {string[]} messages
 */

/** @param {string} output */
function parseErrorLines(output) {
  /** @type {string[]} */
  const files = [];
  for (const line of output.split(/\r?\n/)) {
    const match = ERROR_LINE.exec(line);
    if (match?.[1]) files.push(match[1].split(path.sep).join('/'));
  }
  return files;
}

/** @param {string} output */
export function parseFailingFiles(output) {
  return [...new Set(parseErrorLines(output))].sort();
}

/**
 * A full check: stale incremental buildinfo must not decide which files pass.
 * @param {string} repoRoot
 */
export function hardeningTscArgs(repoRoot) {
  return [
    path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--noEmit',
    '--pretty',
    'false',
    '--incremental',
    'false',
    '-p',
    path.join(repoRoot, 'tsconfig.hardening.json'),
  ];
}

/**
 * @param {string[]} failing
 * @param {string[]} baseline
 */
export function compareAgainstBaseline(failing, baseline) {
  const failingSet = new Set(failing);
  const baselineSet = new Set(baseline);
  return {
    added: failing.filter((file) => !baselineSet.has(file)),
    resolved: baseline.filter((file) => !failingSet.has(file)),
  };
}

/**
 * @param {string} text
 * @param {string} label
 */
function outputTail(text, label) {
  const trimmed = text.trimEnd();
  if (trimmed === '') return [`--- tsc ${label}: (empty)`];
  const lines = trimmed.split(/\r?\n/).slice(-OUTPUT_TAIL_LINES);
  return [`--- last ${lines.length} line(s) of tsc ${label}:`, ...lines];
}

/**
 * tsc crashed, was killed, could not start, or failed without type-checking.
 * @param {TscRun} run
 * @param {number} errorLineCount
 */
function isIncomplete(run, errorLineCount) {
  if (run.error || run.signal) return true;
  if (run.status === 0) return false;
  if (run.status === null || !DIAGNOSTIC_EXIT_CODES.has(run.status)) return true;
  return errorLineCount === 0;
}

/**
 * Decides the ratchet from one finished (or not) tsc run.
 * @param {TscRun} run
 * @param {string[]} baseline
 * @returns {HardeningVerdict}
 */
export function evaluateHardeningRun(run, baseline) {
  const output = `${run.stdout}\n${run.stderr}`;
  const errorLines = parseErrorLines(output);
  const failing = [...new Set(errorLines)].sort();
  const exit = run.signal ? `signal ${run.signal}` : `exit ${run.status}`;
  const messages = [
    `tsc ${exit}; ${errorLines.length} parsed error line(s) in ${failing.length} file(s).`,
  ];

  if (isIncomplete(run, errorLines.length)) {
    messages.push(
      `Typecheck hardening ratchet failed: hardening typecheck did not complete (${exit}).`,
      'No file is reported as fixed or newly failing from an incomplete run.',
    );
    if (run.error) messages.push(`tsc error: ${run.error.message}`);
    messages.push(...outputTail(run.stdout, 'stdout'), ...outputTail(run.stderr, 'stderr'));
    return { ok: false, outcome: 'incomplete', added: [], resolved: [], messages };
  }

  const { added, resolved } = compareAgainstBaseline(failing, baseline);
  if (added.length === 0 && resolved.length === 0) {
    messages.push(
      `Typecheck hardening ratchet holds at ${failing.length} file(s) under ` +
        'noUncheckedIndexedAccess + exactOptionalPropertyTypes.',
    );
    return { ok: true, outcome: 'holds', added, resolved, messages };
  }

  messages.push('Typecheck hardening ratchet failed:');
  for (const file of added) messages.push(`- new file fails the hardening flags: ${file}`);
  for (const file of resolved) {
    messages.push(`- ${file} now passes; remove it from ${BASELINE_HINT}`);
  }
  return { ok: false, outcome: 'drift', added, resolved, messages };
}

/** @returns {TscRun} */
function runHardeningTypecheck() {
  const result = spawnSync(process.execPath, hardeningTscArgs(root), {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error } : {}),
  };
}

function main() {
  if (!existsSync(baselinePath)) {
    console.error(`Hardening baseline is missing: ${baselinePath}`);
    process.exitCode = 1;
    return;
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (!Array.isArray(baseline.files)) {
    console.error('Hardening baseline is invalid: expected a "files" array.');
    process.exitCode = 1;
    return;
  }

  const verdict = evaluateHardeningRun(runHardeningTypecheck(), baseline.files);
  const log = verdict.ok ? console.log : console.error;
  for (const message of verdict.messages) log(message);
  if (!verdict.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
