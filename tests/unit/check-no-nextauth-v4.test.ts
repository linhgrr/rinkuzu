import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findForbiddenLegacyAuthSymbols } from '../../scripts/check-no-nextauth-v4.mjs';

const temporaryRoots: string[] = [];

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rinkuzu-auth-v4-gate-'));
  temporaryRoots.push(root);
  for (const [repoPath, source] of Object.entries(files)) {
    const filePath = path.join(root, repoPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('legacy Auth.js gate', () => {
  it('finds forbidden v4 symbols without requiring ripgrep', () => {
    const legacySymbol = ['getServer', 'Session'].join('');
    const rootDir = createFixture({
      'src/clean.ts': 'export const clean = true;\n',
      'src/legacy.ts': `export const legacy = ${legacySymbol};\n`,
    });

    expect(
      findForbiddenLegacyAuthSymbols({ rootDir, scanRoots: ['src'], allow: new Set() }),
    ).toEqual([`src/legacy.ts:1:export const legacy = ${legacySymbol};`]);
  });

  it('honours exact allowlisted files while scanning supported extensions only', () => {
    const legacyEnv = ['NEXT', 'AUTH_SECRET'].join('');
    const rootDir = createFixture({
      'tests/allowed.ts': `const name = '${legacyEnv}';\n`,
      'tests/ignored.txt': legacyEnv,
    });

    expect(
      findForbiddenLegacyAuthSymbols({
        rootDir,
        scanRoots: ['tests'],
        allow: new Set(['tests/allowed.ts']),
      }),
    ).toEqual([]);
  });
});
