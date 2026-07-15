import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CRITICAL_MUTATION_PATTERNS, selectCriticalMutationFiles } from './mutation-scope.mjs';

const root = process.cwd();
const mode = process.env['MUTATION_MODE'] ?? 'changed';

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fail(message) {
  throw new Error(`Mutation scope resolution failed: ${message}`);
}

function writeOutput(name, value) {
  const outputPath = process.env['GITHUB_OUTPUT'];
  if (outputPath) appendFileSync(outputPath, `${name}=${value}\n`, 'utf8');
}

if (!['changed', 'full'].includes(mode)) fail(`unsupported mode ${JSON.stringify(mode)}`);

const headSha = git('rev-parse', 'HEAD');
let baseSha = null;
let files = [];

if (mode === 'changed') {
  const baseRef = process.env['MUTATION_BASE_REF'];
  if (!baseRef) fail('MUTATION_BASE_REF is required in changed mode');
  baseSha = git('rev-parse', `${baseRef}^{commit}`);
  const changedPaths = git(
    'diff',
    '--name-only',
    '--diff-filter=ACMRTUXB',
    `${baseSha}...${headSha}`,
    '--',
  )
    .split(/\r?\n/)
    .filter(Boolean);
  files = selectCriticalMutationFiles(changedPaths).filter((file) =>
    existsSync(path.join(root, file)),
  );
}

const evidenceDirectory = path.join(root, 'reports', 'mutation');
mkdirSync(evidenceDirectory, { recursive: true });
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode,
  baseSha,
  headSha,
  files,
  fullPatterns: mode === 'full' ? CRITICAL_MUTATION_PATTERNS : null,
  outcome: mode === 'changed' && files.length === 0 ? 'not_applicable' : 'mutation_required',
};
writeFileSync(
  path.join(evidenceDirectory, 'scope.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);

writeOutput('mode', mode);
writeOutput('count', String(files.length));
writeOutput('files', files.join(','));
process.stdout.write(
  mode === 'full'
    ? `Full critical mutation scope selected (${CRITICAL_MUTATION_PATTERNS.length} patterns).\n`
    : `Changed critical mutation scope selected (${files.length} file(s)).\n`,
);
