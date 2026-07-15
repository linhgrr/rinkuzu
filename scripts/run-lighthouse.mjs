import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '..');

const REQUIRED_BUILD_FILES = [
  '.next/BUILD_ID',
  '.next/build-manifest.json',
  '.next/routes-manifest.json',
  '.next/prerender-manifest.json',
  '.next/required-server-files.json',
  '.next/diagnostics/route-bundle-stats.json',
];

const normalizeRelativePath = (value) => value.split(path.sep).join('/');

const isPathInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};

const walkRegularFiles = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files = [];
  const pending = [directoryPath];
  while (pending.length > 0) {
    const currentPath = pending.pop();
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      } else {
        throw new Error(`Build identity does not allow non-regular files: ${absolutePath}`);
      }
    }
  }

  return files;
};

export const sha256File = (targetPath) =>
  crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

export const collectImmutableBuildFiles = (rootDir = defaultRootDir) => {
  const files = new Set();
  for (const relativePath of REQUIRED_BUILD_FILES) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Required production build file is missing: ${relativePath}`);
    }
    files.add(absolutePath);
  }

  const staticFiles = walkRegularFiles(path.join(rootDir, '.next', 'static'));
  if (staticFiles.length === 0) {
    throw new Error('Production build contains no .next/static files');
  }
  for (const absolutePath of staticFiles) {
    files.add(absolutePath);
  }

  for (const absolutePath of walkRegularFiles(path.join(rootDir, '.next', 'server'))) {
    if (/\.(?:cjs|js|mjs|wasm)$/i.test(absolutePath)) {
      files.add(absolutePath);
    }
  }

  for (const relativePath of ['.next/standalone/server.js', '.next/standalone/package.json']) {
    const absolutePath = path.join(rootDir, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.add(absolutePath);
    }
  }

  for (const absolutePath of walkRegularFiles(path.join(rootDir, 'public'))) {
    files.add(absolutePath);
  }

  return [...files].sort((left, right) =>
    normalizeRelativePath(path.relative(rootDir, left)).localeCompare(
      normalizeRelativePath(path.relative(rootDir, right)),
    ),
  );
};

export const computeNextBuildDigest = (rootDir = defaultRootDir) => {
  const digest = crypto.createHash('sha256');
  const files = collectImmutableBuildFiles(rootDir);
  for (const absolutePath of files) {
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
    const stat = fs.statSync(absolutePath);
    digest.update(relativePath);
    digest.update('\0');
    digest.update(String(stat.size));
    digest.update('\0');
    digest.update(fs.readFileSync(absolutePath));
    digest.update('\0');
  }
  return digest.digest('hex');
};

const readJson = (targetPath, label) => {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label} is missing or malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parsed;
};

export const collectManifestReports = (rootDir, lighthouseOutputDir) => {
  const manifestPath = path.join(lighthouseOutputDir, 'manifest.json');
  const manifest = readJson(manifestPath, 'Lighthouse filesystem manifest');
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('Lighthouse filesystem manifest must be a non-empty array');
  }

  const seenPaths = new Set();
  const reports = manifest.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.jsonPath !== 'string') {
      throw new Error(`Lighthouse manifest entry ${index} has no jsonPath`);
    }
    const absolutePath = path.resolve(lighthouseOutputDir, entry.jsonPath);
    if (!isPathInside(lighthouseOutputDir, absolutePath)) {
      throw new Error(`Lighthouse report escapes its output directory: ${entry.jsonPath}`);
    }
    if (seenPaths.has(absolutePath)) {
      throw new Error(`Lighthouse manifest reuses a report path: ${entry.jsonPath}`);
    }
    seenPaths.add(absolutePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Lighthouse report is missing: ${entry.jsonPath}`);
    }
    const stat = fs.statSync(absolutePath);
    return {
      path: normalizeRelativePath(path.relative(rootDir, absolutePath)),
      sha256: sha256File(absolutePath),
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  });

  return {
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    reports: reports.sort((left, right) => left.path.localeCompare(right.path)),
  };
};

const writeJsonAtomic = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, targetPath);
};

export const runLighthouse = (rootDir = defaultRootDir) => {
  const configPath = path.join(rootDir, 'lighthouserc.cjs');
  const lighthouseOutputDir = path.join(rootDir, 'perf', 'lighthouse');
  const evidencePath = path.join(lighthouseOutputDir, 'evidence.json');
  const startedAt = new Date();
  const evidence = {
    schemaVersion: 1,
    mode: process.env.PERF_MODE || 'local',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    expectedRuns: null,
    expectedUrls: [],
    buildDigestBefore: null,
    buildDigestAfter: null,
    configSha256: null,
    manifestSha256: null,
    rawReports: [],
    lhciExitCode: null,
    lhciSignal: null,
    errors: [],
    ok: false,
  };

  try {
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);
    const policy = config.productionPolicy;
    if (!policy || policy.schemaVersion !== 1) {
      throw new Error('lighthouserc.cjs is missing productionPolicy schema version 1');
    }

    evidence.mode = policy.mode;
    evidence.expectedRuns = policy.expectedRuns;
    evidence.expectedUrls = policy.urls;
    evidence.configSha256 = sha256File(configPath);
    evidence.buildDigestBefore = computeNextBuildDigest(rootDir);

    const expectedBuildDigest = process.env.PERF_EXPECTED_BUILD_DIGEST;
    if (expectedBuildDigest && expectedBuildDigest !== evidence.buildDigestBefore) {
      evidence.errors.push(
        `PERF_EXPECTED_BUILD_DIGEST does not match the production build (${expectedBuildDigest} != ${evidence.buildDigestBefore})`,
      );
    }

    const lhciCliPath = require.resolve('@lhci/cli/src/cli.js');
    const result = spawnSync(process.execPath, [lhciCliPath, 'autorun', '--config', configPath], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });

    evidence.lhciExitCode = typeof result.status === 'number' ? result.status : null;
    evidence.lhciSignal = result.signal || null;
    if (result.error) {
      evidence.errors.push(`Unable to execute Lighthouse CI: ${result.error.message}`);
    }
    if (evidence.lhciExitCode === null) {
      evidence.errors.push('Lighthouse CI did not return an exit code');
    } else if (evidence.lhciExitCode !== 0 && evidence.lhciExitCode !== 1) {
      evidence.errors.push(`Lighthouse CI exited with unexpected status ${evidence.lhciExitCode}`);
    }

    evidence.buildDigestAfter = computeNextBuildDigest(rootDir);
    if (evidence.buildDigestBefore !== evidence.buildDigestAfter) {
      evidence.errors.push('Production build identity changed while Lighthouse was running');
    }

    try {
      const manifest = collectManifestReports(rootDir, lighthouseOutputDir);
      evidence.manifestSha256 = manifest.manifestSha256;
      evidence.rawReports = manifest.reports;
    } catch (error) {
      evidence.errors.push(error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    evidence.errors.push(error instanceof Error ? error.message : String(error));
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.ok = evidence.errors.length === 0;
  writeJsonAtomic(evidencePath, evidence);

  if (!evidence.ok) {
    console.error(JSON.stringify(evidence, null, 2));
  }

  return evidence.ok && evidence.lhciExitCode === 0 ? 0 : 1;
};

const isMainModule =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  process.exitCode = runLighthouse();
}
