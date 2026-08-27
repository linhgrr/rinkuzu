import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

/**
 * Copies BILLING_INTERNAL_HMAC_SECRET from `.env` to the system clipboard so it
 * can be pasted into Vercel without ever being displayed, echoed into a shell
 * history, or passed through an agent transcript.
 */

const KEY = 'BILLING_INTERNAL_HMAC_SECRET';
const ENV_PATH = '.env';

if (!existsSync(ENV_PATH)) {
  console.error(`[secret] ${ENV_PATH} does not exist. Run: npm run generate:billing-secret`);
  process.exit(1);
}

const match = new RegExp(`^${KEY}=(.*)$`, 'm').exec(readFileSync(ENV_PATH, 'utf8'));
const value = match?.[1]?.trim() ?? '';

if (!value) {
  console.error(`[secret] ${KEY} is not set in ${ENV_PATH}. Run: npm run generate:billing-secret`);
  process.exit(1);
}
if (value.length < 32) {
  console.error(
    `[secret] ${KEY} is only ${value.length} characters. The application rejects anything ` +
      'under 32. Run: npm run generate:billing-secret -- --force',
  );
  process.exit(1);
}

const clipboard =
  process.platform === 'win32'
    ? { command: 'clip', args: [] }
    : process.platform === 'darwin'
      ? { command: 'pbcopy', args: [] }
      : { command: 'xclip', args: ['-selection', 'clipboard'] };

const result = spawnSync(clipboard.command, clipboard.args, {
  input: value,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});

if (result.error || result.status !== 0) {
  console.error(
    `[secret] Could not reach the clipboard via "${clipboard.command}".\n` +
      `         Open ${ENV_PATH} and copy the ${KEY} value by hand instead.`,
  );
  process.exit(1);
}

console.log(
  `[secret] ${KEY} (${value.length} chars) is on the clipboard. The value was not printed.\n\n` +
    'Paste it into Vercel:\n' +
    '  Project quizz-ck → Settings → Environment Variables → Add Environment Variable\n' +
    `  Type: Secret   Key: ${KEY}   Environment: Production\n\n` +
    'Then run: npm run deploy:schedulers',
);
