import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { generateTypes, lintOpenApi } from './adaptive-contract.shared.mjs';

const root = process.cwd();
const lockPath = path.join(root, 'contracts/adaptive-api.lock.json');

function fail(message) {
  throw new Error(`Vendored adaptive contract check failed: ${message}`);
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readLock() {
  if (!existsSync(lockPath)) fail('contracts/adaptive-api.lock.json is missing');
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (error) {
    fail(`lock file is malformed: ${error.message}`);
  }
}

function assertToolVersion(packageName, expected) {
  const packagePath = path.join(root, 'node_modules', packageName, 'package.json');
  if (!existsSync(packagePath)) fail(`${packageName} is not installed`);
  const actual = JSON.parse(readFileSync(packagePath, 'utf8')).version;
  if (actual !== expected)
    fail(`${packageName} version mismatch: expected ${expected}, got ${actual}`);
}

const lock = readLock();
if (lock.schemaVersion !== 1) fail(`unsupported lock schema ${lock.schemaVersion}`);
if (!/^[a-f0-9]{40}$/.test(lock.source?.commit ?? '')) fail('source commit must be a full SHA');

for (const [name, artifact] of Object.entries(lock.artifacts ?? {})) {
  const artifactPath = path.join(root, artifact.path ?? '');
  if (!existsSync(artifactPath)) fail(`${name} artifact is missing: ${artifact.path}`);
  const actual = sha256(artifactPath);
  if (actual !== artifact.sha256)
    fail(`${name} digest mismatch: expected ${artifact.sha256}, got ${actual}`);
}

assertToolVersion('openapi-typescript', lock.toolchain?.['openapi-typescript']);
assertToolVersion('@redocly/cli', lock.toolchain?.redocly);
assertToolVersion('prettier', lock.toolchain?.prettier);

const openapiPath = path.join(root, lock.artifacts.openapi.path);
const generatedTypesPath = path.join(root, lock.artifacts.typescript.path);
const tempDir = mkdtempSync(path.join(root, '.adaptive-contract-check-'));
const regeneratedPath = path.join(tempDir, 'adaptive-api.d.ts');

try {
  lintOpenApi(openapiPath);
  generateTypes(openapiPath, regeneratedPath);
  if (readFileSync(generatedTypesPath, 'utf8') !== readFileSync(regeneratedPath, 'utf8')) {
    fail('generated TypeScript does not match the vendored OpenAPI artifact');
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

process.stdout.write(
  `Vendored adaptive contract is pinned to ${lock.source.repository}@${lock.source.commit}.\n`,
);
