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

const PRETTIER_CONFIG = resolve(FRONTEND_ROOT, '.prettierrc');
const BACKEND_VENV_PYTHON = resolve(
  BACKEND_ROOT,
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';
const UV_BIN = process.env.UV_BIN ?? 'uv';
const CONTRACT_EXPORT_ENV = Object.freeze({
  ENVIRONMENT: 'dev',
  // Deterministic non-secret fixture: contract export must not depend on a local backend .env.
  INTERNAL_SERVICE_TOKEN: 'rinkuzu-ci-fixture-0123456789abcdef-token',
});

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

function resolvePackageBin(packageName, binName) {
  const packageJsonPath = resolve(FRONTEND_ROOT, 'node_modules', packageName, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error(`${packageName} is not installed`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];
  if (typeof bin !== 'string' || bin.length === 0) {
    throw new Error(`${packageName} does not expose the expected ${binName} binary`);
  }
  return resolve(dirname(packageJsonPath), bin);
}

function commandExists(command) {
  if ((command.includes('/') || command.includes('\\')) && !existsSync(command)) return false;
  return canRun(command);
}

function resolveBackendPythonRunner() {
  const explicitPython = process.env.ADAPTIVE_BACKEND_PYTHON;
  if (explicitPython) {
    if (commandExists(explicitPython)) {
      return { command: explicitPython, argsPrefix: [] };
    }

    throw new Error(`ADAPTIVE_BACKEND_PYTHON is set but not runnable: ${explicitPython}`);
  }

  if (commandExists(BACKEND_VENV_PYTHON)) {
    return { command: BACKEND_VENV_PYTHON, argsPrefix: [] };
  }

  if (
    (existsSync(resolve(BACKEND_ROOT, 'uv.lock')) ||
      existsSync(resolve(BACKEND_ROOT, 'pyproject.toml'))) &&
    commandExists(UV_BIN)
  ) {
    return { command: UV_BIN, argsPrefix: ['run', 'python'] };
  }

  for (const candidate of ['python3', 'python']) {
    if (commandExists(candidate)) return { command: candidate, argsPrefix: [] };
  }

  throw new Error(
    'No usable Python runner found for backend contract export. Run `cd ../rinkuzu-ai-api && uv sync`, install Python, or set ADAPTIVE_BACKEND_PYTHON.',
  );
}

export function createTempSchemaPath(name = 'adaptive-openapi.json') {
  return resolve(tmpdir(), `rinkuzu-${Date.now()}-${name}`);
}

export function ensureGeneratedDir() {
  mkdirSync(dirname(GENERATED_TYPES_PATH), { recursive: true });
}

export function exportOpenApi(schemaPath) {
  const runner = resolveBackendPythonRunner();
  run(runner.command, [...runner.argsPrefix, 'scripts/export_openapi.py', '--output', schemaPath], {
    cwd: BACKEND_ROOT,
    env: CONTRACT_EXPORT_ENV,
  });
}

export function lintOpenApi(schemaPath) {
  run(
    process.execPath,
    [resolvePackageBin('@redocly/cli', 'redocly'), 'lint', schemaPath, '--extends', 'minimal'],
    {
      cwd: FRONTEND_ROOT,
    },
  );
}

export function generateTypes(schemaPath, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  run(
    process.execPath,
    [resolvePackageBin('openapi-typescript', 'openapi-typescript'), schemaPath, '-o', outputPath],
    {
      cwd: FRONTEND_ROOT,
    },
  );
  formatContractArtifact(outputPath);
}

export function formatContractArtifact(filePath) {
  run(
    process.execPath,
    [
      resolvePackageBin('prettier', 'prettier'),
      '--write',
      '--config',
      PRETTIER_CONFIG,
      '--ignore-path',
      NULL_DEVICE,
      filePath,
    ],
    { cwd: FRONTEND_ROOT },
  );
}

export function readText(path) {
  return readFileSync(path, 'utf8');
}
