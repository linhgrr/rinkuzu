import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

/**
 * Manages a shared secret that must hold the same value in `.env`, on the
 * hosting provider, and on a Cloudflare worker.
 *
 * The value is never printed. It goes from the CSPRNG into `.env`, from `.env`
 * to the clipboard for a single paste, and from `.env` to Cloudflare via
 * `deploy:schedulers`. `fingerprint` prints a short SHA-256 prefix so two sides
 * can be compared without either being revealed.
 *
 *   npm run secret -- generate CRON_SECRET [--force]
 *   npm run secret -- copy CRON_SECRET
 *   npm run secret -- fingerprint CRON_SECRET
 */

const ENV_PATH = '.env';
const MIN_LENGTH = 32;

const [command, key, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');

if (!command || !key) {
  console.error('Usage: npm run secret -- <generate|copy|fingerprint> <KEY> [--force]');
  process.exit(64);
}
if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
  console.error(`Refusing an unusual env key name: ${key}`);
  process.exit(64);
}

function readEnvFile() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
}

const matcher = new RegExp(`^${key}=(.*)$`, 'm');

/** @returns {string} */
function currentValue() {
  return matcher.exec(readEnvFile())?.[1]?.trim() ?? '';
}

/** Short, non-invertible identifier for comparing two copies of one secret. */
function fingerprintOf(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function requireValue() {
  const value = currentValue();
  if (!value) {
    console.error(`[secret] ${key} is not set in ${ENV_PATH}.`);
    console.error(`         Run: npm run secret -- generate ${key}`);
    process.exit(1);
  }
  if (value.length < MIN_LENGTH) {
    console.error(
      `[secret] ${key} is only ${value.length} characters; the application requires ${MIN_LENGTH}.`,
    );
    process.exit(1);
  }
  return value;
}

if (command === 'generate') {
  const existing = currentValue();
  if (existing && !force) {
    console.log(
      `[secret] ${key} is already set in ${ENV_PATH} (${existing.length} chars,` +
        ` fingerprint ${fingerprintOf(existing)}).\n` +
        '         Nothing changed. Pass --force to replace it — then update every place\n' +
        '         that holds it, in the same sitting, or the sides will disagree.',
    );
    process.exit(0);
  }

  const secret = randomBytes(32).toString('hex');
  const source = readEnvFile();
  const line = `${key}=${secret}`;
  const next = matcher.test(source)
    ? source.replace(matcher, line)
    : `${source}${source.length === 0 || source.endsWith('\n') ? '' : '\n'}${line}\n`;
  writeFileSync(ENV_PATH, next, { encoding: 'utf8' });

  console.log(
    `[secret] ${existing ? 'Replaced' : 'Wrote'} ${key} in ${ENV_PATH}` +
      ` (${secret.length} chars, fingerprint ${fingerprintOf(secret)}).\n` +
      '         The value was not printed.\n\n' +
      `Next:\n  1. npm run secret -- copy ${key}    # clipboard, paste into the provider\n` +
      '  2. redeploy the app so it picks the new value up\n' +
      '  3. npm run deploy:schedulers -- --rotate-secrets\n',
  );
  process.exit(0);
}

if (command === 'fingerprint') {
  const value = requireValue();
  console.log(
    `[secret] ${key} in ${ENV_PATH}: ${value.length} chars, fingerprint ${fingerprintOf(value)}`,
  );
  console.log('         Two sides hold the same secret only if their fingerprints match.');
  process.exit(0);
}

if (command === 'copy') {
  const value = requireValue();
  const target =
    process.platform === 'win32'
      ? { command: 'clip', args: [] }
      : process.platform === 'darwin'
        ? { command: 'pbcopy', args: [] }
        : { command: 'xclip', args: ['-selection', 'clipboard'] };

  const result = spawnSync(target.command, target.args, {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    console.error(`[secret] Could not reach the clipboard via "${target.command}".`);
    console.error(`         Open ${ENV_PATH} and copy the ${key} value by hand instead.`);
    process.exit(1);
  }

  console.log(
    `[secret] ${key} (${value.length} chars, fingerprint ${fingerprintOf(value)}) is on the` +
      ' clipboard. The value was not printed.',
  );
  process.exit(0);
}

console.error(`Unknown command: ${command}. Expected generate, copy or fingerprint.`);
process.exit(64);
