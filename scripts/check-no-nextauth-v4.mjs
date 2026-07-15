#!/usr/bin/env node
/**
 * Fail CI if Auth.js v4 symbols remain in application source.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pattern =
  'authOptions|getServerSession|getToken\\(|NextAuthOptions|NEXTAUTH_|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|next-auth\\.session-token|__Secure-next-auth\\.session-token';

function writeOut(message) {
  process.stdout.write(`${message}\n`);
}

function writeErr(message) {
  process.stderr.write(`${message}\n`);
}

let output = '';
try {
  output = execFileSync(
    'rg',
    [
      '-n',
      '--glob',
      '*.{ts,tsx,js,mjs,cjs,sh,yml,yaml}',
      pattern,
      'src',
      'scripts',
      '.github',
      'tests',
    ],
    { cwd: root, encoding: 'utf8' },
  );
} catch (error) {
  // rg exit 1 = no matches
  if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
    writeOut('check-no-nextauth-v4: clean');
    process.exit(0);
  }
  throw error;
}

const allow = [
  // Historical mention in secret-exposure contract (must stay forbidden).
  'src/config/next-config-secrets.test.ts',
  // This gate script itself contains the pattern string.
  'scripts/check-no-nextauth-v4.mjs',
];

const hits = output
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((line) => !allow.some((prefix) => line.startsWith(prefix)));

if (hits.length > 0) {
  writeErr('Forbidden NextAuth v4 / legacy auth symbols found:\n');
  writeErr(hits.join('\n'));
  process.exit(1);
}

writeOut('check-no-nextauth-v4: clean');
