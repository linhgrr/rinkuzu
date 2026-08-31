#!/usr/bin/env node
/**
 * Fail CI if Auth.js v4 symbols remain in application source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pattern =
  'authOptions|getServerSession|getToken\\(|NextAuthOptions|NEXTAUTH_|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|next-auth\\.session-token|__Secure-next-auth\\.session-token';
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml']);
// '.' means the repository-root files themselves, not a recursive walk from the
// root. Config that boots the app lives there -- playwright.config.ts,
// next.config.ts, middleware.ts -- and until 2026-08-30 none of it was scanned,
// so a live NEXTAUTH_URL in playwright.config.ts passed this gate as clean.
const defaultScanRoots = ['.', 'src', 'scripts', '.github', 'tests'];
const defaultAllow = new Set([
  // This gate script itself contains the pattern string.
  'scripts/check-no-nextauth-v4.mjs',
  // Declares the ban rather than reaching for the symbol: the getServerSession
  // here is a no-restricted-imports entry that forbids calling it.
  'eslint.config.mjs',
  // The gate's own meta-test builds fixtures out of the forbidden patterns.
  'tests/quality/check-no-nextauth-v4.test.ts',
]);

/**
 * @param {{
 *   rootDir: string,
 *   scanRoots?: string[],
 *   allow?: ReadonlySet<string>,
 * }} input
 * @returns {string[]}
 */
export function findForbiddenLegacyAuthSymbols({
  rootDir,
  scanRoots = defaultScanRoots,
  allow = defaultAllow,
}) {
  const forbidden = new RegExp(pattern, 'g');
  const hits = [];

  for (const scanRoot of scanRoots) {
    const directory = path.join(rootDir, scanRoot);
    // '*' does not descend, so the repository root is read without walking
    // into node_modules or revisiting every other scan root.
    const filePaths = listFiles(scanRoot === '.' ? '*' : '**/*', { cwd: directory });
    for (const filePath of filePaths) {
      if (!scannedExtensions.has(path.extname(filePath))) continue;
      const repoPath = toRepoPath(filePath, rootDir);
      if (allow.has(repoPath)) continue;

      const source = readFileSync(filePath, 'utf8');
      const lines = source.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        forbidden.lastIndex = 0;
        if (forbidden.test(line)) hits.push(`${repoPath}:${index + 1}:${line}`);
      }
    }
  }

  return hits.sort((left, right) => left.localeCompare(right));
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const hits = findForbiddenLegacyAuthSymbols({ rootDir: root });
  if (hits.length > 0) {
    process.stderr.write(
      `Forbidden NextAuth v4 / legacy auth symbols found:\n\n${hits.join('\n')}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('check-no-nextauth-v4: clean\n');
  }
}
