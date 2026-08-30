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
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'quality', 'typecheck-hardening-baseline.json');

/** tsc reports `path/to/file.ts(12,34): error TS2532: ...`. */
const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;

export function parseFailingFiles(output) {
  const files = new Set();
  for (const line of output.split(/\r?\n/)) {
    const match = ERROR_LINE.exec(line);
    if (match) files.add(match[1].split(path.sep).join('/'));
  }
  return [...files].sort();
}

function runHardeningTypecheck() {
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
        '--noEmit',
        '--pretty',
        'false',
        '-p',
        path.join(root, 'tsconfig.hardening.json'),
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return '';
  } catch (error) {
    // tsc exits non-zero whenever it reports anything, which is the normal path
    // here: the whole point is that some files still fail.
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

export function compareAgainstBaseline(failing, baseline) {
  const failingSet = new Set(failing);
  const baselineSet = new Set(baseline);
  return {
    added: failing.filter((file) => !baselineSet.has(file)),
    resolved: baseline.filter((file) => !failingSet.has(file)),
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

  const failing = parseFailingFiles(runHardeningTypecheck());
  const { added, resolved } = compareAgainstBaseline(failing, baseline.files);

  if (added.length === 0 && resolved.length === 0) {
    console.log(
      `Typecheck hardening ratchet holds at ${failing.length} file(s) under ` +
        'noUncheckedIndexedAccess + exactOptionalPropertyTypes.',
    );
    return;
  }

  console.error('Typecheck hardening ratchet failed:');
  for (const file of added) {
    console.error(`- new file fails the hardening flags: ${file}`);
  }
  for (const file of resolved) {
    console.error(`- ${file} now passes; remove it from quality/typecheck-hardening-baseline.json`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
