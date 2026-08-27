import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import process from 'node:process';

/**
 * Generates the internal billing shared secret straight into `.env`.
 *
 * The value is never printed and never passes through a terminal, a shell
 * history, or an agent transcript: it goes from the CSPRNG into the file. From
 * there `npm run deploy:schedulers` pushes it to Cloudflare without anyone
 * reading it, and `npm run copy:billing-secret` puts it on the clipboard for the
 * single paste into Vercel.
 *
 * Usage:
 *   node scripts/generate-billing-secret.mjs            # refuses to overwrite
 *   node scripts/generate-billing-secret.mjs --force    # rotate it
 *   node scripts/generate-billing-secret.mjs --print-length
 */

const KEY = 'BILLING_INTERNAL_HMAC_SECRET';
const ENV_PATH = '.env';

const argv = process.argv.slice(2);
const force = argv.includes('--force');

/** @returns {string} */
function readEnv() {
  if (!existsSync(ENV_PATH)) return '';
  return readFileSync(ENV_PATH, 'utf8');
}

const source = readEnv();
const lineMatcher = new RegExp(`^${KEY}=(.*)$`, 'm');
const existing = lineMatcher.exec(source);
const existingValue = existing?.[1]?.trim() ?? '';

if (existingValue && !force) {
  // Rotating this secret breaks every already-deployed scheduler until it is
  // re-deployed, so overwriting is opt-in.
  console.log(
    `[secret] ${KEY} is already set in ${ENV_PATH} (${existingValue.length} chars).\n` +
      '         Nothing changed. Pass --force to rotate it, then redeploy the\n' +
      '         schedulers and update Vercel in the same sitting.',
  );
  process.exit(0);
}

// 32 bytes of CSPRNG output as hex: 64 characters, comfortably over the
// 32-character floor the application and the deploy script both enforce.
const secret = randomBytes(32).toString('hex');
const line = `${KEY}=${secret}`;

let next;
if (existing) {
  next = source.replace(lineMatcher, line);
} else {
  const separator = source.length === 0 || source.endsWith('\n') ? '' : '\n';
  next = `${source}${separator}${line}\n`;
}

writeFileSync(ENV_PATH, next, { encoding: 'utf8' });

console.log(
  `[secret] ${existing ? 'Rotated' : 'Wrote'} ${KEY} into ${ENV_PATH} (${secret.length} chars).\n` +
    '         The value was not printed.\n\n' +
    'Next:\n' +
    `  1. npm run copy:billing-secret     # clipboard, then paste into Vercel as a Secret\n` +
    '  2. npm run deploy:schedulers       # pushes the same value to Cloudflare\n\n' +
    'Both sides must hold the identical string or every cron tick returns 401.',
);
