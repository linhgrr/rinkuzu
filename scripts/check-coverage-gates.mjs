import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function repoPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function sourceFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['generated', 'node_modules'].includes(entry)) sourceFiles(fullPath, files);
    } else if (
      /\.(?:ts|tsx)$/.test(entry) &&
      !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry) &&
      !entry.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function hasDeclareModifier(node) {
  return (
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false
  );
}

export function isTypeOnlySource(sourceText, filePath = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return sourceFile.statements.every((statement) => {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    ) {
      return true;
    }
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) return false;
      if (clause.isTypeOnly) return true;
      if (clause.name) return false;
      return (
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every((element) => element.isTypeOnly)
      );
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return true;
      return (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)
      );
    }
    return hasDeclareModifier(statement);
  });
}

export function metricFromValues(values) {
  const entries = Object.values(values ?? {}).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
  const covered = entries.reduce((total, value) => total + (Number(value) > 0 ? 1 : 0), 0);
  return {
    total: entries.length,
    covered,
    pct: entries.length === 0 ? 100 : (covered / entries.length) * 100,
  };
}

export function fileMetrics(record) {
  return {
    statements: metricFromValues(record.s),
    functions: metricFromValues(record.f),
    branches: metricFromValues(record.b),
  };
}

function combineMetrics(metrics) {
  const total = metrics.reduce((sum, metric) => sum + metric.total, 0);
  const covered = metrics.reduce((sum, metric) => sum + metric.covered, 0);
  return { total, covered, pct: total === 0 ? 100 : (covered / total) * 100 };
}

export function parseLcov(source, root = process.cwd()) {
  const records = new Map();
  let current = null;

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const rawPath = line.slice(3);
      const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(root, rawPath);
      current = { lines: new Map() };
      records.set(repoPath(root, absolutePath), current);
    } else if (current && line.startsWith('DA:')) {
      const [lineNumber, hits] = line.slice(3).split(',').map(Number);
      current.lines.set(lineNumber, hits);
    } else if (line === 'end_of_record') {
      current = null;
    }
  }

  return records;
}

function lineMetric(record) {
  return metricFromValues(Object.fromEntries(record?.lines ?? []));
}

function percentageFailure(label, metric, threshold) {
  if (metric.total === 0 || metric.pct + Number.EPSILON >= threshold) return null;
  return `${label}: ${metric.pct.toFixed(2)}% is below ${threshold}% (${metric.covered}/${metric.total}).`;
}

function changedLinesFromDiff(diff) {
  const changed = new Map();
  let currentFile = null;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      if (!changed.has(currentFile)) changed.set(currentFile, new Set());
      continue;
    }
    if (!currentFile || !line.startsWith('@@')) continue;

    const match = line.match(/\+(\d+)(?:,(\d+))?/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) {
      changed.get(currentFile).add(start + offset);
    }
  }

  return changed;
}

function collectChangedLines(root, baseRef) {
  const revision = baseRef === 'HEAD' ? 'HEAD' : `${baseRef}...HEAD`;
  const diff = execFileSync(
    'git',
    ['diff', '--no-ext-diff', '--unified=0', '--diff-filter=ACMR', revision, '--', 'src'],
    { cwd: root, encoding: 'utf8' },
  );
  const changed = changedLinesFromDiff(diff);
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', 'src'],
    { cwd: root, encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter((file) => /\.(?:ts|tsx)$/.test(file));

  for (const file of untracked) {
    const count = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).length;
    changed.set(file, new Set(Array.from({ length: count }, (_, index) => index + 1)));
  }

  return changed;
}

function locationTouchesLines(location, changedLines) {
  if (!location || !changedLines) return false;
  const start = location.start?.line ?? location.startLine;
  const end = location.end?.line ?? location.endLine ?? start;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  for (let line = start; line <= end; line += 1) {
    if (changedLines.has(line)) return true;
  }
  return false;
}

function scopedValues(values, locationMap, changedLines) {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([id]) =>
      locationTouchesLines(locationMap?.[id]?.loc ?? locationMap?.[id], changedLines),
    ),
  );
}

export function changedMetrics(record, lcovRecord, changedLines) {
  const changedLineHits = Object.fromEntries(
    [...(lcovRecord?.lines ?? [])].filter(([line]) => changedLines.has(line)),
  );

  return {
    lines: metricFromValues(changedLineHits),
    statements: metricFromValues(scopedValues(record.s, record.statementMap, changedLines)),
    functions: metricFromValues(scopedValues(record.f, record.fnMap, changedLines)),
    branches: metricFromValues(scopedValues(record.b, record.branchMap, changedLines)),
  };
}

export function evaluateThresholds(label, metrics, thresholds) {
  return Object.entries(thresholds)
    .map(([metricName, threshold]) =>
      percentageFailure(`${label} ${metricName}`, metrics[metricName], threshold),
    )
    .filter(Boolean);
}

export function evaluateBaseline(metrics, baseline) {
  const failures = [];
  for (const [metricName, expected] of Object.entries(baseline)) {
    const actual = metrics[metricName];
    if (!actual || !Number.isInteger(expected.covered) || !Number.isInteger(expected.total)) {
      failures.push(`global ${metricName}: baseline is invalid.`);
      continue;
    }
    const baselinePct = expected.total === 0 ? 100 : (expected.covered / expected.total) * 100;
    if (actual.covered < expected.covered) {
      failures.push(
        `global ${metricName}: covered count ${actual.covered} is below baseline ${expected.covered}.`,
      );
    }
    if (actual.pct + Number.EPSILON < baselinePct) {
      failures.push(
        `global ${metricName}: ${actual.pct.toFixed(4)}% regressed below baseline ${baselinePct.toFixed(4)}%.`,
      );
    }
  }
  return failures;
}

function matchesCriticalPath(file, policy) {
  return policy.globs.some((glob) => path.matchesGlob(file, glob));
}

function normalizeCoverageRecords(coverage, root) {
  return new Map(
    Object.entries(coverage).map(([filePath, record]) => {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
      return [repoPath(root, absolutePath), record];
    }),
  );
}

export function evaluateCoverageGate({
  root,
  coverage,
  lcov,
  policy,
  changedLines = new Map(),
  runtimeFiles,
}) {
  const failures = [];
  const records = normalizeCoverageRecords(coverage, root);
  const executableFiles = runtimeFiles.filter(
    (file) => !isTypeOnlySource(readFileSync(path.join(root, file), 'utf8'), file),
  );

  for (const file of executableFiles) {
    if (!records.has(file)) failures.push(`${file}: missing from coverage-final.json.`);
  }

  const coveredRuntimeRecords = executableFiles
    .map((file) => [file, records.get(file)])
    .filter((entry) => entry[1]);

  for (const [file, record] of coveredRuntimeRecords) {
    const metrics = fileMetrics(record);
    const statementMetric = metrics.statements;
    if (statementMetric.total > 0 && !lcov.has(file)) {
      failures.push(`${file}: missing from lcov.info.`);
    }
    if (matchesCriticalPath(file, policy)) {
      failures.push(
        ...evaluateThresholds(
          file,
          { ...metrics, lines: lineMetric(lcov.get(file)) },
          policy.thresholds,
        ),
      );
    }
  }

  const globalMetrics = {
    lines: combineMetrics(coveredRuntimeRecords.map(([file]) => lineMetric(lcov.get(file)))),
    statements: combineMetrics(
      coveredRuntimeRecords.map(([, record]) => fileMetrics(record).statements),
    ),
    functions: combineMetrics(
      coveredRuntimeRecords.map(([, record]) => fileMetrics(record).functions),
    ),
    branches: combineMetrics(
      coveredRuntimeRecords.map(([, record]) => fileMetrics(record).branches),
    ),
  };
  failures.push(...evaluateBaseline(globalMetrics, policy.globalBaseline.metrics));

  for (const [file, lines] of changedLines) {
    if (!file.startsWith('src/') || !/\.(?:ts|tsx)$/.test(file)) continue;
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) || file.endsWith('.d.ts')) continue;
    if (!existsSync(path.join(root, file))) continue;
    if (isTypeOnlySource(readFileSync(path.join(root, file), 'utf8'), file)) continue;
    if (!policy.changedGlobs.some((glob) => path.matchesGlob(file, glob))) continue;

    const record = records.get(file);
    if (!record) {
      failures.push(`${file}: changed executable file is absent from coverage.`);
      continue;
    }
    const metrics = changedMetrics(record, lcov.get(file), lines);
    failures.push(...evaluateThresholds(`${file} changed`, metrics, policy.changedThresholds));
  }

  return { failures, globalMetrics, executableFileCount: executableFiles.length };
}

export function runCoverageGate(root = process.cwd()) {
  const coveragePath = path.join(root, 'coverage', 'coverage-final.json');
  const lcovPath = path.join(root, 'coverage', 'lcov.info');
  const policyPath = path.join(root, 'quality', 'critical-coverage-paths.json');

  for (const requiredPath of [coveragePath, lcovPath, policyPath]) {
    if (!existsSync(requiredPath))
      throw new Error(`Required coverage artifact is missing: ${requiredPath}`);
  }

  const runtimePaths = sourceFiles(path.join(root, 'src'));
  const newestSourceMtime = Math.max(...runtimePaths.map((file) => statSync(file).mtimeMs));
  const oldestReportMtime = Math.min(statSync(coveragePath).mtimeMs, statSync(lcovPath).mtimeMs);
  if (oldestReportMtime + 1_000 < newestSourceMtime) {
    throw new Error('Coverage artifacts are stale relative to executable source files.');
  }

  const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
  const lcov = parseLcov(readFileSync(lcovPath, 'utf8'), root);
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (
    policy.schemaVersion !== 1 ||
    !Array.isArray(policy.globs) ||
    !Array.isArray(policy.changedGlobs) ||
    !policy.thresholds ||
    !policy.changedThresholds ||
    !policy.globalBaseline?.metrics
  ) {
    throw new Error('Critical coverage policy is invalid.');
  }

  const baseRef = process.env['COVERAGE_BASE_REF'] ?? 'HEAD';
  const changedLines = collectChangedLines(root, baseRef);
  return evaluateCoverageGate({
    root,
    coverage,
    lcov,
    policy,
    changedLines,
    runtimeFiles: runtimePaths.map((file) => repoPath(root, file)),
  });
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  try {
    const result = runCoverageGate();
    if (result.failures.length > 0) {
      console.error('Coverage gate failed:');
      for (const failure of result.failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `Coverage gate passed for ${result.executableFileCount} executable source files.\n`,
      );
    }
  } catch (error) {
    console.error(`Coverage gate failed closed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
