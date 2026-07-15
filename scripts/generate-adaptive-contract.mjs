import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  GENERATED_TYPES_PATH,
  createTempSchemaPath,
  ensureGeneratedDir,
  exportOpenApi,
  generateTypes,
  lintOpenApi,
} from './adaptive-contract.shared.mjs';

const frontendRoot = process.cwd();
const backendRoot = path.resolve(frontendRoot, '..', 'rinkuzu-ai-api');
const openapiPath = path.join(frontendRoot, 'contracts/adaptive-openapi.json');
const lockPath = path.join(frontendRoot, 'contracts/adaptive-api.lock.json');
const schemaPath = createTempSchemaPath();

const git = (...args) => execFileSync('git', args, { cwd: backendRoot, encoding: 'utf8' }).trim();
const sha256 = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');
const packageVersion = (packageName) =>
  JSON.parse(
    readFileSync(path.join(frontendRoot, 'node_modules', packageName, 'package.json'), 'utf8'),
  ).version;

const backendStatus = git('status', '--porcelain');
if (backendStatus) {
  throw new Error('Adaptive contract source repository must be clean before export');
}

const commit = git('rev-parse', 'HEAD');
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Backend commit is not a full Git SHA');

const remote = git('remote', 'get-url', 'origin');
const githubRepository = remote.match(/github\.com(?::|\/)([^\s]+?)(?:\.git)?$/)?.[1] ?? remote;

try {
  ensureGeneratedDir();
  mkdirSync(path.dirname(openapiPath), { recursive: true });
  exportOpenApi(schemaPath);
  lintOpenApi(schemaPath);
  execFileSync(
    path.join(frontendRoot, 'node_modules/.bin/prettier'),
    [
      '--write',
      '--config',
      path.join(frontendRoot, '.prettierrc'),
      '--ignore-path',
      '/dev/null',
      schemaPath,
    ],
    { cwd: frontendRoot, stdio: 'inherit' },
  );
  copyFileSync(schemaPath, openapiPath);
  generateTypes(openapiPath, GENERATED_TYPES_PATH);

  const lock = {
    schemaVersion: 1,
    source: {
      repository: githubRepository,
      commit,
    },
    artifacts: {
      openapi: {
        path: path.relative(frontendRoot, openapiPath).split(path.sep).join('/'),
        sha256: sha256(openapiPath),
      },
      typescript: {
        path: path.relative(frontendRoot, GENERATED_TYPES_PATH).split(path.sep).join('/'),
        sha256: sha256(GENERATED_TYPES_PATH),
      },
    },
    toolchain: {
      'openapi-typescript': packageVersion('openapi-typescript'),
      redocly: packageVersion('@redocly/cli'),
      prettier: packageVersion('prettier'),
    },
  };
  const pendingLockPath = `${lockPath}.tmp`;
  writeFileSync(pendingLockPath, `${JSON.stringify(lock, null, 2)}\n`);
  renameSync(pendingLockPath, lockPath);
} finally {
  rmSync(schemaPath, { force: true });
}

process.stdout.write(`Vendored adaptive contract from ${githubRepository}@${commit}.\n`);
