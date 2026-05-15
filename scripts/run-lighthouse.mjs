import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('../lighthouserc.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const result = spawnSync(
  'npx',
  ['lhci', 'autorun', '--config', path.join(rootDir, 'lighthouserc.cjs')],
  {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
