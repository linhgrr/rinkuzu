import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import prettier from 'prettier';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function assertSafeSourcePath(root, fileName) {
  const sourceRoot = path.resolve(root, 'src');
  const normalizedFileName = fileName.replaceAll('\\', '/');
  const absolutePath = path.resolve(sourceRoot, normalizedFileName);
  if (absolutePath !== sourceRoot && !absolutePath.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`jscpd reported a path outside src: ${fileName}`);
  }
  return absolutePath;
}

function readCloneFragment(root, file) {
  if (
    typeof file?.name !== 'string' ||
    !Number.isInteger(file.start) ||
    !Number.isInteger(file.end) ||
    file.start < 1 ||
    file.end < file.start
  ) {
    throw new Error('jscpd reported an invalid clone location.');
  }

  const absolutePath = assertSafeSourcePath(root, file.name);
  const source = readFileSync(absolutePath, 'utf8').replaceAll('\r\n', '\n');
  const lines = source.split('\n');
  if (file.end > lines.length) {
    throw new Error(`jscpd clone range exceeds src/${file.name}.`);
  }

  return lines.slice(file.start - 1, file.end).join('\n');
}

function fragmentEndpoint(root, file) {
  const fragment = readCloneFragment(root, file);
  const normalizedName = file.name.replaceAll('\\', '/');
  return `src/${normalizedName}\0${sha256(fragment)}`;
}

function isImportOnlyFragment(fragment) {
  const sourceFile = ts.createSourceFile(
    'clone-fragment.tsx',
    fragment,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  // Runtime still attaches parseDiagnostics; public SourceFile types no longer expose it.
  // Fail closed when diagnostics are missing or not an array — never treat unknown state as import-only.
  const parseDiagnostics = /** @type {{ parseDiagnostics?: unknown }} */ (sourceFile)
    .parseDiagnostics;
  if (!Array.isArray(parseDiagnostics) || parseDiagnostics.length !== 0) {
    return false;
  }
  return (
    sourceFile.statements.length > 0 &&
    sourceFile.statements.every(
      (statement) => ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement),
    )
  );
}

export function isImportOnlyDuplicate(root, duplicate) {
  return [duplicate?.firstFile, duplicate?.secondFile].every((file) =>
    isImportOnlyFragment(readCloneFragment(root, file)),
  );
}

/**
 * Whether a clone fragment is nothing but a list of field declarations.
 *
 * The same argument as isImportOnlyFragment, for the other thing no helper can
 * remove. docs/architecture/three-layer-standard.md requires each layer to
 * declare its own record shapes and forbids sharing them, so a report's field
 * list appears once in the persistence record, once in the entity, once in the
 * DTO and once in the view model *by design*. jscpd sees four copies of the
 * same text and is right about the text; extracting them into one shared
 * interface is precisely what the standard exists to prevent.
 *
 * This stays narrow on purpose. It matches only property signatures -- no
 * methods, no runtime statements -- and fails closed on anything it cannot
 * parse, so duplicated logic that happens to sit near a type is still counted.
 */
export function isFieldListOnlyFragment(fragment) {
  const withoutWrapper = fragment
    .replace(/^\s*(?:export\s+)?(?:interface|type)\s+\w+[^{]*\{/, '')
    .replace(/\}\s*;?\s*$/, '');
  if (withoutWrapper.trim().length === 0) return false;

  const sourceFile = ts.createSourceFile(
    'clone-fragment.ts',
    `interface CloneFragmentProbe {
${withoutWrapper}
}`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const parseDiagnostics = /** @type {{ parseDiagnostics?: unknown }} */ (sourceFile)
    .parseDiagnostics;
  if (!Array.isArray(parseDiagnostics) || parseDiagnostics.length !== 0) return false;

  const [probe] = sourceFile.statements;
  if (!probe || !ts.isInterfaceDeclaration(probe) || probe.members.length === 0) return false;
  return probe.members.every(
    (member) => ts.isPropertySignature(member) || ts.isIndexSignatureDeclaration(member),
  );
}

export function isFieldListOnlyDuplicate(root, duplicate) {
  return [duplicate?.firstFile, duplicate?.secondFile].every((file) =>
    isFieldListOnlyFragment(readCloneFragment(root, file)),
  );
}

/**
 * The totals the ceilings are measured against.
 *
 * jscpd's own statistics count every clone it found, mandated ones included.
 * Those were already excluded from fingerprint regression and left in the raw
 * ceilings, which meant the ceiling number mixed "duplication somebody could
 * remove" with "duplication the standard requires" -- and the second kind grows
 * every time a record shape is correctly split across layers. The ceilings now
 * measure the removable kind, which is the number a ratchet can honestly
 * demand goes down.
 */
export function removableTotals(report, removableDuplicates) {
  const duplicatedLines = removableDuplicates.reduce(
    (sum, duplicate) => sum + (duplicate.lines ?? 0),
    0,
  );
  const lines = report.statistics?.total?.lines ?? 0;
  return {
    sources: report.statistics?.total?.sources ?? 0,
    clones: removableDuplicates.length,
    duplicatedLines,
    lines,
    percentage: lines === 0 ? 0 : (duplicatedLines / lines) * 100,
  };
}

/** Clones the architecture mandates, which the ratchet must not count. */
export function isMandatedDuplicate(root, duplicate) {
  return isImportOnlyDuplicate(root, duplicate) || isFieldListOnlyDuplicate(root, duplicate);
}

export function fingerprintDuplicate(root, duplicate) {
  if (typeof duplicate?.format !== 'string') {
    throw new Error('jscpd reported a clone without a format.');
  }
  const endpoints = [
    fragmentEndpoint(root, duplicate.firstFile),
    fragmentEndpoint(root, duplicate.secondFile),
  ].sort();
  return sha256(JSON.stringify({ format: duplicate.format, endpoints }));
}

function duplicateLabel(duplicate) {
  const label = (file) => `src/${file.name}:${file.start}-${file.end}`;
  return `${label(duplicate.firstFile)} <-> ${label(duplicate.secondFile)}`;
}

/**
 * What the baseline is a baseline *of*.
 *
 * It used to claim a commit SHA, which could never be true: the baseline is
 * always cut from a working tree that does not yet have a commit, so the field
 * either named the parent commit — whose sources it does not describe — or a
 * SHA that would only exist after the file containing it was written. Neither
 * can be checked, and the one that shipped named an object that was not in the
 * repository at all.
 *
 * A fingerprint of the detector configuration can be checked, on every run,
 * against the file it describes. It is deliberately not a fingerprint of the
 * sources: those change with every commit, and a provenance field that must be
 * regenerated on every edit is one that gets regenerated without being read.
 */
export function duplicationConfigFingerprint(baseline) {
  return sha256(
    JSON.stringify({
      detector: baseline.detector,
      scope: baseline.scope,
      minimumAnalyzedSources: baseline.minimumAnalyzedSources,
      limits: baseline.limits,
    }),
  );
}

export function validateDuplicationProvenance(baseline) {
  const errors = [];
  if (baseline.generatedFrom !== 'working-tree') {
    errors.push(
      `Duplication baseline generatedFrom must be "working-tree"; received ${JSON.stringify(baseline.generatedFrom)}.`,
    );
  }
  const expected = duplicationConfigFingerprint(baseline);
  if (baseline.configFingerprint !== expected) {
    errors.push(
      `Duplication baseline configFingerprint is ${baseline.configFingerprint ?? 'missing'}; the recorded detector, scope and limits hash to ${expected}.`,
    );
  }
  return errors;
}

export function validateDuplicationConfig(config, baseline) {
  const expected = {
    path: baseline.scope.paths,
    format: baseline.scope.formats,
    mode: baseline.detector.mode,
    minLines: baseline.detector.minLines,
    minTokens: baseline.detector.minTokens,
    maxSize: baseline.detector.maxSize,
    threshold: baseline.limits.percentage,
    reporters: ['json'],
    output: 'reports/jscpd',
    ignore: baseline.scope.ignore,
    gitignore: true,
    skipLocal: false,
    absolute: false,
  };
  const errors = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (JSON.stringify(config?.[key]) !== JSON.stringify(expectedValue)) {
      errors.push(
        `.jscpd.json ${key} must be ${JSON.stringify(expectedValue)}; received ${JSON.stringify(config?.[key])}.`,
      );
    }
  }
  return errors;
}

export function validateDuplicationReport(
  report,
  baseline,
  fingerprints,
  fingerprintedDuplicates = report?.duplicates,
) {
  const errors = [];
  if (
    baseline?.schemaVersion !== 1 ||
    !baseline.limits ||
    !Array.isArray(baseline.knownCloneFingerprints)
  ) {
    return ['Duplication baseline is invalid.'];
  }

  const duplicates = report?.duplicates;
  const total = report?.statistics?.total;
  if (!Array.isArray(duplicates) || !total) {
    return ['jscpd report is invalid or incomplete.'];
  }
  if (duplicates.length !== total.clones) {
    errors.push(
      `jscpd report is inconsistent: ${duplicates.length} clone records but total.clones=${total.clones}.`,
    );
  }
  if (
    !Array.isArray(fingerprints) ||
    !Array.isArray(fingerprintedDuplicates) ||
    fingerprints.length !== fingerprintedDuplicates.length ||
    fingerprintedDuplicates.some((duplicate) => !duplicates.includes(duplicate))
  ) {
    errors.push('Clone fingerprints are missing or incomplete.');
    return errors;
  }

  const uniqueFingerprints = new Set(fingerprints);
  if (uniqueFingerprints.size !== fingerprints.length) {
    errors.push('Clone fingerprints are ambiguous; refusing to treat the report as green.');
  }

  const removable = removableTotals(report, fingerprintedDuplicates);
  if (total.sources < baseline.minimumAnalyzedSources) {
    errors.push(
      `Only ${total.sources} source files were analyzed; minimum is ${baseline.minimumAnalyzedSources}.`,
    );
  }
  if (removable.clones > baseline.limits.clones) {
    errors.push(
      `Removable clone count ${removable.clones} exceeds the ceiling ${baseline.limits.clones}.`,
    );
  }
  if (removable.duplicatedLines > baseline.limits.duplicatedLines) {
    errors.push(
      `Removable duplicated lines ${removable.duplicatedLines} exceed the ceiling ${baseline.limits.duplicatedLines}.`,
    );
  }
  if (removable.percentage > baseline.limits.percentage) {
    errors.push(
      `Removable duplication ${removable.percentage.toFixed(4)}% exceeds the ceiling ${baseline.limits.percentage}%.`,
    );
  }

  // The fingerprint set has to match the report exactly, in both directions.
  //
  // An unknown fingerprint is a new duplicate, which has always failed. A
  // *stale* one — a fingerprint the baseline carries that the report no longer
  // produces — now fails too, and that is what closes the laundering hole:
  // regenerating the baseline can no longer append a new clone quietly among
  // entries nobody has checked, because every entry has to correspond to a
  // clone that actually exists at the moment of regeneration. The cost is that
  // removing duplication requires re-cutting the baseline, which is the point.
  const known = new Set(baseline.knownCloneFingerprints);
  const observed = new Set(fingerprints);
  fingerprints.forEach((fingerprint, index) => {
    if (!known.has(fingerprint)) {
      errors.push(`New duplicate detected: ${duplicateLabel(fingerprintedDuplicates[index])}.`);
    }
  });
  for (const fingerprint of known) {
    if (!observed.has(fingerprint)) {
      errors.push(
        `Baseline fingerprint ${fingerprint} matches no clone in the report; re-cut quality/duplication-baseline.json.`,
      );
    }
  }
  return errors;
}

export function runDuplicationCheck(root = process.cwd()) {
  const configPath = path.join(root, '.jscpd.json');
  const baselinePath = path.join(root, 'quality', 'duplication-baseline.json');
  const reportDirectory = path.join(root, 'reports', 'jscpd');
  const reportPath = path.join(reportDirectory, 'jscpd-report.json');
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const configuredVersion = packageJson.devDependencies?.jscpd;
  const errors = [];

  errors.push(...validateDuplicationProvenance(baseline));
  errors.push(...validateDuplicationConfig(config, baseline));
  if (configuredVersion !== baseline.detector.version) {
    errors.push(
      `jscpd must be pinned to ${baseline.detector.version}; package.json has ${configuredVersion ?? 'none'}.`,
    );
  }

  const installedPackagePath = path.join(root, 'node_modules', 'jscpd', 'package.json');
  if (!existsSync(installedPackagePath)) {
    errors.push('Pinned jscpd package is not installed.');
  } else {
    const installedVersion = JSON.parse(readFileSync(installedPackagePath, 'utf8')).version;
    if (installedVersion !== baseline.detector.version) {
      errors.push(
        `Installed jscpd must be ${baseline.detector.version}; found ${installedVersion ?? 'unknown'}.`,
      );
    }
  }

  rmSync(reportDirectory, { recursive: true, force: true });
  const runner = path.join(root, 'node_modules', 'jscpd', 'run-jscpd.js');
  const detector = spawnSync(process.execPath, [runner, '--config', configPath, '--no-tips'], {
    cwd: root,
    encoding: 'utf8',
  });
  process.stdout.write(detector.stdout ?? '');
  process.stderr.write(detector.stderr ?? '');

  if (!existsSync(reportPath)) {
    errors.push('Fresh jscpd JSON report was not produced.');
  } else {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const fingerprintedDuplicates = report.duplicates.filter(
      (duplicate) => !isMandatedDuplicate(root, duplicate),
    );
    const fingerprints = fingerprintedDuplicates.map((duplicate) =>
      fingerprintDuplicate(root, duplicate),
    );
    errors.push(
      ...validateDuplicationReport(report, baseline, fingerprints, fingerprintedDuplicates),
    );
    const total = report.statistics.total;
    const mandatedClones = report.duplicates.length - fingerprintedDuplicates.length;
    process.stdout.write(
      `jscpd analyzed ${total.sources} files: ${total.clones} clones, ${total.duplicatedLines}/${total.lines} duplicated lines (${total.percentage.toFixed(4)}%).\n`,
    );
    if (mandatedClones > 0) {
      process.stdout.write(
        `${mandatedClones} mandated clone(s) -- import lists and cross-layer field lists -- excluded; ` +
          `ceilings measure the ${fingerprintedDuplicates.length} removable clone(s).\n`,
      );
    }
  }
  if (detector.error) errors.push(`jscpd failed to start: ${detector.error.message}`);
  if (detector.signal) errors.push(`jscpd was terminated by ${detector.signal}.`);
  if (detector.status !== 0 && detector.status !== null) {
    errors.push(`jscpd exited with status ${detector.status}.`);
  }

  return errors;
}

/**
 * Guards that must hold before the baseline is rewritten.
 *
 * The ratchet check keeps this tool from ever raising a ceiling: it may only
 * lower `limits.clones` / `limits.duplicatedLines`, never raise them. A fresh
 * total above either current ceiling is a real regression — it must be argued
 * for explicitly (by hand-editing the baseline and its ceilings, if that is
 * ever genuinely warranted) rather than absorbed silently by a routine re-cut.
 * The ambiguous-fingerprint check catches two clones that hash identically,
 * which would make the fingerprint set unable to tell them apart.
 */
export function assertRatchetableBaseline(baseline, { fingerprints, totals }) {
  const unique = new Set(fingerprints);
  if (unique.size !== fingerprints.length) {
    throw new Error('Clone fingerprints are ambiguous; refusing to write a baseline.');
  }
  if (
    totals.clones > baseline.limits.clones ||
    totals.duplicatedLines > baseline.limits.duplicatedLines
  ) {
    throw new Error(
      `This tool only ratchets down: clones ${totals.clones}/${baseline.limits.clones}, ` +
        `duplicatedLines ${totals.duplicatedLines}/${baseline.limits.duplicatedLines}.`,
    );
  }
}

/**
 * Re-cuts the baseline from a fresh detector run.
 *
 * It exists so the artifact cannot be hand-edited into an internally
 * inconsistent state — the ceilings, the fingerprint set and the configuration
 * fingerprint are always written together from one report. Every added and
 * removed clone is printed with its location, so a re-cut that quietly admits a
 * new duplicate is visible in the console and, because the fingerprint list is
 * in the file, in the diff a reviewer reads.
 *
 * It only ratchets down: `assertRatchetableBaseline` throws before anything is
 * written if the fresh totals exceed either existing ceiling. Raising a
 * ceiling is a real regression, not something a baseline tool should be able
 * to launder into a routine re-cut — it has to be a deliberate, explicit edit
 * that a reviewer can see and argue with.
 */
export async function rebaselineDuplication(root = process.cwd()) {
  const baselinePath = path.join(root, 'quality', 'duplication-baseline.json');
  const reportPath = path.join(root, 'reports', 'jscpd', 'jscpd-report.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

  runDuplicationCheck(root);
  if (!existsSync(reportPath)) throw new Error('No jscpd report to re-cut the baseline from.');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const fingerprinted = report.duplicates.filter(
    (duplicate) => !isMandatedDuplicate(root, duplicate),
  );
  const fingerprints = fingerprinted.map((duplicate) => fingerprintDuplicate(root, duplicate));
  const previous = new Set(baseline.knownCloneFingerprints);
  const total = removableTotals(report, fingerprinted);

  assertRatchetableBaseline(baseline, { fingerprints, totals: total });

  const updated = {
    ...baseline,
    generatedFrom: 'working-tree',
    limits: {
      clones: total.clones,
      duplicatedLines: total.duplicatedLines,
      percentage: baseline.limits.percentage,
    },
    knownCloneFingerprints: [...fingerprints].sort(),
  };
  delete updated.sourceCommit;
  delete updated.sourceNote;
  updated.configFingerprint = duplicationConfigFingerprint(updated);

  for (const [index, fingerprint] of fingerprints.entries()) {
    if (!previous.has(fingerprint)) {
      process.stdout.write(`+ new clone admitted: ${duplicateLabel(fingerprinted[index])}\n`);
    }
  }
  for (const fingerprint of previous) {
    if (!fingerprints.includes(fingerprint)) {
      process.stdout.write(`- clone removed: ${fingerprint}\n`);
    }
  }
  // Written through Prettier because the artifact is checked in and
  // `format:check` is a required gate: a re-cut that left the file in raw
  // `JSON.stringify` shape would fail formatting every time, which invites
  // hand-editing the artifact back into shape — the one thing writing it from a
  // single report is meant to prevent.
  const serialised = `${JSON.stringify(updated, null, 2)}\n`;
  const prettierOptions = await prettier.resolveConfig(baselinePath);
  writeFileSync(
    baselinePath,
    await prettier.format(serialised, { ...prettierOptions, parser: 'json' }),
  );
  process.stdout.write(
    `Baseline re-cut: ${total.clones} clones, ${total.duplicatedLines} duplicated lines.\n`,
  );
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  if (process.argv.includes('--rebaseline')) {
    await rebaselineDuplication();
  } else {
    const errors = runDuplicationCheck();
    if (errors.length > 0) {
      console.error('Duplicate-code check failed:');
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      process.stdout.write('Duplicate-code check passed with no baseline regression.\n');
    }
  }
}
