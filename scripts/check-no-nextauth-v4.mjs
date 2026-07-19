#!/usr/bin/env node
/**
 * Fail CI if Auth.js v4 symbols remain in application source.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pattern =
  'authOptions|getServerSession|getToken\\(|NextAuthOptions|NEXTAUTH_|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|next-auth\\.session-token|__Secure-next-auth\\.session-token';
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml']);
const defaultScanRoots = ['src', 'scripts', '.github', 'tests'];
const defaultAllow = new Set([
  // This gate script itself contains the pattern string.
  'scripts/check-no-nextauth-v4.mjs',
]);

function toRepoPath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

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
    for (const filePath of walkFiles(directory)) {
      if (!scannedExtensions.has(path.extname(filePath))) continue;
      const repoPath = toRepoPath(rootDir, filePath);
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
