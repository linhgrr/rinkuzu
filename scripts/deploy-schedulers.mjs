import { spawnSync } from 'node:child_process';
import process from 'node:process';
import 'dotenv/config';

/**
 * Deploys the Cloudflare cron schedulers.
 *
 * This is a local operator command rather than a CI job on purpose: the
 * repository's CI security policy forbids long-lived secrets in GitHub Actions
 * (`scripts/check-ci-security.mjs` allows only GITHUB_TOKEN), so Cloudflare
 * credentials must never reach a workflow. Everything else about the rollout is
 * automated here — preconditions, secret upload, deploy, and verification of
 * the cron triggers — so it is one command, not a runbook.
 *
 * Usage:
 *   npm run deploy:schedulers -- --dry-run
 *   npm run deploy:schedulers
 *   npm run deploy:schedulers -- --only billing-scheduler
 *   npm run deploy:schedulers -- --rotate-secrets
 */

// Pinned so two operators cannot deploy with two different wrangler versions.
const WRANGLER = 'wrangler@4.42.0';

const WORKERS = [
  {
    name: 'billing-scheduler',
    secret: 'BILLING_INTERNAL_HMAC_SECRET',
    // Without this worker nothing drains the payment webhook inbox.
    critical: true,
  },
  {
    name: 'communications-scheduler',
    secret: 'CRON_SECRET',
    critical: false,
  },
];

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
/**
 * Uploading a secret that is already set replaces it. If the local `.env` value
 * has drifted from what the application expects, that silently breaks a working
 * worker — every tick 401s afterwards. So an existing secret is left alone
 * unless rotation is asked for explicitly.
 */
const rotateSecrets = argv.includes('--rotate-secrets');
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex === -1 ? null : argv[onlyIndex + 1];

if (only && !WORKERS.some((worker) => worker.name === only)) {
  console.error(`Unknown worker: ${only}. Known: ${WORKERS.map((w) => w.name).join(', ')}`);
  process.exit(64);
}

const selected = only ? WORKERS.filter((worker) => worker.name === only) : WORKERS;

function requireEnv(name, { minLength = 1 } = {}) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[deploy] ${name} is not set.`);
    return null;
  }
  if (value.length < minLength) {
    console.error(`[deploy] ${name} must be at least ${minLength} characters.`);
    return null;
  }
  return value;
}

const missing = [];
if (!requireEnv('CLOUDFLARE_API_TOKEN')) missing.push('CLOUDFLARE_API_TOKEN');
if (!requireEnv('CLOUDFLARE_ACCOUNT_ID')) missing.push('CLOUDFLARE_ACCOUNT_ID');
for (const worker of selected) {
  // The app rejects a shared secret shorter than 32 characters at runtime, so
  // deploying one would produce a worker that 401s on every tick.
  if (!requireEnv(worker.secret, { minLength: 32 })) missing.push(worker.secret);
}
if (missing.length) {
  console.error(
    `\nDeploy aborted. Set these in the environment (or .env) first:\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

/** @returns {string[]} secret names already configured on the worker */
function existingSecretNames(cwd) {
  const result = spawnSync('npx', ['--yes', WRANGLER, 'secret', 'list'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0 || !result.stdout) return [];
  // wrangler prints a JSON array, sometimes preceded by banner lines.
  const start = result.stdout.indexOf('[');
  if (start === -1) return [];
  try {
    const parsed = JSON.parse(result.stdout.slice(start));
    return Array.isArray(parsed)
      ? parsed.map((entry) => entry?.name).filter((name) => typeof name === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * @param {string[]} args
 * @param {{ cwd?: string, input?: string }} [options]
 */
function run(args, options = {}) {
  const { cwd, input } = options;
  const label = `npx ${args.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] ${label}${cwd ? `  (cwd: ${cwd})` : ''}`);
    return { status: 0, stdout: '' };
  }
  const result = spawnSync('npx', ['--yes', ...args], {
    cwd,
    input,
    encoding: 'utf8',
    stdio: input === undefined ? ['inherit', 'pipe', 'inherit'] : ['pipe', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  return result;
}

let failed = 0;
for (const worker of selected) {
  const cwd = `infra/cloudflare/${worker.name}`;
  console.log(`\n[deploy] ${worker.name}`);

  // Secret first: a worker deployed without it fails every cron tick with a
  // 401 that nothing is watching. But an existing secret is left alone —
  // replacing a working one with a drifted local value breaks the worker
  // silently, and every tick 401s from then on.
  const alreadySet = dryRun ? [] : existingSecretNames(cwd);
  if (!rotateSecrets && alreadySet.includes(worker.secret)) {
    console.log(
      `[deploy] ${worker.secret} is already set on ${worker.name}; left untouched.` +
        ' Pass --rotate-secrets to replace it.',
    );
  } else {
    const secretResult = run([WRANGLER, 'secret', 'put', worker.secret], {
      cwd,
      input: `${process.env[worker.secret].trim()}\n`,
    });
    if (secretResult.status !== 0) {
      console.error(`[deploy] failed to publish ${worker.secret} for ${worker.name}`);
      failed += 1;
      continue;
    }
  }

  const deployResult = run([WRANGLER, 'deploy'], { cwd });
  if (deployResult.status !== 0) {
    console.error(`[deploy] failed to deploy ${worker.name}`);
    failed += 1;
    continue;
  }

  // A worker with no cron trigger deploys cleanly and then never runs, which is
  // indistinguishable from "deployed successfully" unless it is checked.
  const triggers = run([WRANGLER, 'triggers', 'deploy'], { cwd });
  if (triggers.status !== 0) {
    console.error(`[deploy] failed to sync cron triggers for ${worker.name}`);
    failed += 1;
    continue;
  }

  console.log(
    dryRun ? `[deploy] ${worker.name} plan complete.` : `[deploy] ${worker.name} is live.`,
  );
}

if (failed > 0) {
  const criticalNames = selected.filter((worker) => worker.critical).map((worker) => worker.name);
  console.error(
    `\n${failed} worker(s) failed to deploy.` +
      (criticalNames.length
        ? ` Verify ${criticalNames.join(', ')} in the Cloudflare dashboard: while it is down,` +
          ' paid orders are only fulfilled when a buyer returns to /checkout.'
        : ''),
  );
  process.exit(1);
}

console.log(
  dryRun
    ? '\n[deploy] dry run complete; nothing was sent to Cloudflare.'
    : '\n[deploy] all selected schedulers are deployed.',
);
