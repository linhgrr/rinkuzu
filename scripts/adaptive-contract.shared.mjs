import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(FRONTEND_ROOT, '..');
const BACKEND_ROOT = resolve(REPO_ROOT, 'rinkuzu-ai-api');
export const GENERATED_TYPES_PATH = resolve(FRONTEND_ROOT, 'src/generated/adaptive-api.d.ts');

const BIN_EXT = process.platform === 'win32' ? '.cmd' : '';
const REDOCLY_BIN = resolve(FRONTEND_ROOT, `node_modules/.bin/redocly${BIN_EXT}`);
const OPENAPI_TYPESCRIPT_BIN = resolve(
  FRONTEND_ROOT,
  `node_modules/.bin/openapi-typescript${BIN_EXT}`,
);

function run(command, args, options = {}) {
  const pretty = [command, ...args].join(' ');
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? FRONTEND_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${pretty}`);
  }
}

function canRun(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function resolveBackendPython() {
  const candidates = [
    process.env.ADAPTIVE_BACKEND_PYTHON,
    resolve(BACKEND_ROOT, '.venv/bin/python'),
    'python3',
    'python',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && !existsSync(candidate)) continue;
    if (canRun(candidate)) return candidate;
  }

  throw new Error(
    'No usable Python found for backend contract export. Set ADAPTIVE_BACKEND_PYTHON if needed.',
  );
}

export function createTempSchemaPath(name = 'adaptive-openapi.json') {
  return resolve(tmpdir(), `rinkuzu-${Date.now()}-${name}`);
}

export function ensureGeneratedDir() {
  mkdirSync(dirname(GENERATED_TYPES_PATH), { recursive: true });
}

export function exportOpenApi(schemaPath) {
  run(resolveBackendPython(), ['scripts/export_openapi.py', '--output', schemaPath], {
    cwd: BACKEND_ROOT,
  });
}

export function lintOpenApi(schemaPath) {
  run(REDOCLY_BIN, ['lint', schemaPath, '--extends', 'minimal'], {
    cwd: FRONTEND_ROOT,
  });
}

export function generateTypes(schemaPath, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  run(OPENAPI_TYPESCRIPT_BIN, [schemaPath, '-o', outputPath], {
    cwd: FRONTEND_ROOT,
  });
}

export function readText(path) {
  return readFileSync(path, 'utf8');
}
