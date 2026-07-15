import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { evaluateRouteBudgets, readJsonStrict } from './check-perf-budget.mjs';
import { computeNextBuildDigest } from './run-lighthouse.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '..');

const writeJsonAtomic = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, targetPath);
};

const requireNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
};

export const createPerformanceSizeBaseline = ({
  rootDir,
  configPath,
  outputPath,
  commitSha,
  now = Date.now(),
}) => {
  const resolvedRoot = path.resolve(requireNonEmptyString(rootDir, 'rootDir'));
  const resolvedConfig = path.resolve(requireNonEmptyString(configPath, 'configPath'));
  const resolvedOutput = path.resolve(requireNonEmptyString(outputPath, 'outputPath'));
  const normalizedCommitSha = requireNonEmptyString(commitSha, 'commitSha');

  if (!/^[a-f0-9]{40,64}$/i.test(normalizedCommitSha)) {
    throw new Error('commitSha must be a 40- or 64-character hexadecimal Git object ID');
  }
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Performance baseline root does not exist: ${resolvedRoot}`);
  }

  const rawConfig = readJsonStrict(resolvedConfig, 'Performance size config');
  const result = evaluateRouteBudgets({ rootDir: resolvedRoot, rawConfig });
  const report = {
    schemaVersion: 2,
    generatedAt: new Date(now).toISOString(),
    buildDigest: computeNextBuildDigest(resolvedRoot),
    commitSha: normalizedCommitSha,
    entries: result.entries.map(({ name, sizeBytes }) => ({ name, sizeBytes })),
  };

  writeJsonAtomic(resolvedOutput, report);
  return report;
};

const parseArguments = (argv) => {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Expected --name value pairs; received ${JSON.stringify(argv)}`);
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate argument ${flag}`);
    }
    values.set(flag, value);
  }
  return values;
};

const isMainModule =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const report = createPerformanceSizeBaseline({
      rootDir: args.get('--root-dir') || defaultRootDir,
      configPath: args.get('--config') || path.join(defaultRootDir, '.size-limit.json'),
      outputPath:
        args.get('--output') ||
        path.join(defaultRootDir, '.performance-baseline', 'route-sizes.json'),
      commitSha: args.get('--commit-sha') || process.env.PERF_BASE_SHA,
    });
    process.stdout.write(
      `Performance size baseline recorded for ${report.entries.length} routes at ${report.commitSha}.\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
