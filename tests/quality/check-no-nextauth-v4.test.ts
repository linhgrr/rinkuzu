import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { findForbiddenLegacyAuthSymbols } from '../../scripts/check-no-nextauth-v4.mjs';

const root = process.cwd();
const temporaryDirectories: string[] = [];

/**
 * A sandbox with every default scan root present.
 *
 * walkFiles reads each scan root unconditionally, so a sandbox missing one of
 * them fails on readdirSync rather than on the assertion under test.
 */
function sandbox(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'nextauth-guard-'));
  temporaryDirectories.push(directory);
  for (const scanRoot of ['src', 'scripts', '.github', 'tests']) {
    mkdirSync(path.join(directory, scanRoot), { recursive: true });
  }
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(directory, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop() as string, { recursive: true, force: true });
  }
});

describe('check-no-nextauth-v4', () => {
  it('catches a forbidden symbol in a repository-root config file', () => {
    // The regression this gate missed until 2026-08-30: playwright.config.ts sets
    // the app's environment, sits at the repository root, and was never scanned.
    const directory = sandbox({
      'playwright.config.ts':
        'export default { env: { NEXTAUTH_URL: "http://localhost:3000" } };\n',
    });

    const hits = findForbiddenLegacyAuthSymbols({ rootDir: directory });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('playwright.config.ts:1');
  });

  it('reads the repository root shallowly rather than walking it', () => {
    // A recursive walk from '.' would descend into node_modules and report the
    // whole dependency tree, and would visit every other scan root twice.
    const directory = sandbox({
      'node_modules/next-auth/index.js': 'export const authOptions = {};\n',
      '.next/server/page.js': 'const x = getServerSession;\n',
    });

    expect(findForbiddenLegacyAuthSymbols({ rootDir: directory })).toEqual([]);
  });

  it('still catches symbols inside the nested scan roots', () => {
    const directory = sandbox({
      'src/lib/legacy-auth.ts': 'import { authOptions } from "next-auth";\n',
      'tests/e2e/login.spec.ts': 'const token = process.env.NEXTAUTH_SECRET;\n',
    });

    const hits = findForbiddenLegacyAuthSymbols({ rootDir: directory });

    expect(hits.map((hit) => hit.split(':')[0]).sort()).toEqual([
      'src/lib/legacy-auth.ts',
      'tests/e2e/login.spec.ts',
    ]);
  });

  it('reports each offending line, not just each file', () => {
    const directory = sandbox({
      'src/auth-legacy.ts':
        'const a = getServerSession;\nconst b = 1;\nconst c = NextAuthOptions;\n',
    });

    const hits = findForbiddenLegacyAuthSymbols({ rootDir: directory });

    expect(hits).toHaveLength(2);
    expect(hits[0]).toContain('src/auth-legacy.ts:1');
    expect(hits[1]).toContain('src/auth-legacy.ts:3');
  });

  it('honours the allow list for files that declare the ban', () => {
    const directory = sandbox({
      'eslint.config.mjs': 'export default [{ importNames: ["getServerSession"] }];\n',
    });

    // eslint.config.mjs is in the default allow list, so the "without" case has to
    // clear it explicitly to show the allow list is what suppresses the hit.
    expect(findForbiddenLegacyAuthSymbols({ rootDir: directory, allow: new Set() })).toHaveLength(
      1,
    );
    expect(
      findForbiddenLegacyAuthSymbols({ rootDir: directory, allow: new Set(['eslint.config.mjs']) }),
    ).toEqual([]);
  });

  it('ignores files whose extension carries no scannable source', () => {
    const directory = sandbox({
      'README.md': 'Set NEXTAUTH_URL before running.\n',
      '.env.example': 'NEXTAUTH_SECRET=\n',
    });

    expect(findForbiddenLegacyAuthSymbols({ rootDir: directory })).toEqual([]);
  });

  it('finds nothing in this repository', () => {
    expect(findForbiddenLegacyAuthSymbols({ rootDir: root })).toEqual([]);
  });
});
