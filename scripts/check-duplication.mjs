import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function assertSafeSourcePath(root, fileName) {
  const sourceRoot = path.resolve(root, 'src');
  const absolutePath = path.resolve(sourceRoot, fileName);
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

  if (total.sources < baseline.minimumAnalyzedSources) {
    errors.push(
      `Only ${total.sources} source files were analyzed; minimum is ${baseline.minimumAnalyzedSources}.`,
    );
  }
  if (total.clones > baseline.limits.clones) {
    errors.push(`Clone count ${total.clones} exceeds the ceiling ${baseline.limits.clones}.`);
  }
  if (total.duplicatedLines > baseline.limits.duplicatedLines) {
    errors.push(
      `Duplicated lines ${total.duplicatedLines} exceed the ceiling ${baseline.limits.duplicatedLines}.`,
    );
  }
  if (total.percentage > baseline.limits.percentage) {
    errors.push(
      `Duplication ${total.percentage.toFixed(4)}% exceeds the ceiling ${baseline.limits.percentage}%.`,
    );
  }

  const known = new Set(baseline.knownCloneFingerprints);
  fingerprints.forEach((fingerprint, index) => {
    if (!known.has(fingerprint)) {
      errors.push(`New duplicate detected: ${duplicateLabel(fingerprintedDuplicates[index])}.`);
    }
  });
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
      (duplicate) => !isImportOnlyDuplicate(root, duplicate),
    );
    const fingerprints = fingerprintedDuplicates.map((duplicate) =>
      fingerprintDuplicate(root, duplicate),
    );
    errors.push(
      ...validateDuplicationReport(report, baseline, fingerprints, fingerprintedDuplicates),
    );
    const total = report.statistics.total;
    const importOnlyClones = report.duplicates.length - fingerprintedDuplicates.length;
    process.stdout.write(
      `jscpd analyzed ${total.sources} files: ${total.clones} clones, ${total.duplicatedLines}/${total.lines} duplicated lines (${total.percentage.toFixed(4)}%).\n`,
    );
    if (importOnlyClones > 0) {
      process.stdout.write(
        `${importOnlyClones} import-only clone(s) excluded from fingerprint regression; raw ceilings remain unchanged.\n`,
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

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const errors = runDuplicationCheck();
  if (errors.length > 0) {
    console.error('Duplicate-code check failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Duplicate-code check passed with no baseline regression.\n');
  }
}
