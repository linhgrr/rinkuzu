import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { readCliOptions } from './cli-options.shared.mjs';

/**
 * One-time activation-nudge backfill (RIN-1002).
 *
 * The eligibility rules live in the app (`src/lib/communication/activation-nudge-*`)
 * and need its full production environment, so this script drives the
 * admin-only route `POST /api/admin/communications/activation-nudge-backfill`
 * instead of copying them. The route answers with counts only; this script
 * prints only those numbers.
 *
 * Usage (an admin session cookie in RINKUZU_ADMIN_COOKIE, read in memory only):
 *   node scripts/activation-nudge-backfill.mjs              # --dry-run, the default
 *   node scripts/activation-nudge-backfill.mjs --apply      # enqueue, 1 send / 30 s
 *   node scripts/activation-nudge-backfill.mjs --base-url=https://www.rinkuzu.app
 *
 * Re-running --apply is a no-op: every account has one row on the dedupe key
 * `activation_nudge:<userId>`.
 *
 * Reversal (cancels every backfill row the worker has not sent yet), in mongosh:
 *   db.emailoutboxes.updateMany({ kind: 'activation_nudge', trigger: 'backfill', status: 'pending' }, { $set: { status: 'canceled', lastError: 'backfill_reverted' } })
 */

const DEFAULT_BASE_URL = 'https://www.rinkuzu.app';
const ROUTE = '/api/admin/communications/activation-nudge-backfill';
const COUNT_FIELDS = ['signups', 'eligible', 'enqueued'];
const EXCLUSIONS = ['activated', 'excluded_account', 'unsubscribed', 'already_nudged', 'too_early'];

/** @param {string[]} argv */
export function readBackfillOptions(argv) {
  const options = readCliOptions(
    {
      'dry-run': { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      'base-url': { type: 'string', default: DEFAULT_BASE_URL },
    },
    argv,
  );
  if (options.apply && options['dry-run']) throw new Error('Pass --dry-run or --apply, not both');
  return { mode: options.apply ? 'apply' : 'dry-run', baseUrl: String(options['base-url']) };
}

/** @param {unknown} value */
function count(value) {
  return Number.isInteger(value) ? Number(value) : 0;
}

/**
 * The printed report: whitelisted numeric fields only, so nothing the route
 * might add (an address, a name, an id) can reach the terminal.
 * @param {Record<string, any>} report
 */
export function formatBackfillReport(report) {
  const excluded = report.excluded ?? {};
  const lines = [
    `mode: ${report.mode === 'apply' ? 'apply' : 'dry-run'}`,
    `window: last ${count(report.lookbackDays)} days`,
    ...COUNT_FIELDS.map((field) => `${field}: ${count(report[field])}`),
    ...EXCLUSIONS.map((reason) => `excluded.${reason}: ${count(excluded[reason])}`),
    `adaptive check: ${report.adaptiveChecked === true ? 'yes' : 'unavailable (eligible is an upper bound)'}`,
  ];
  for (const field of ['firstSendAt', 'lastSendAt']) {
    const at = typeof report[field] === 'string' ? new Date(report[field]) : null;
    if (at && !Number.isNaN(at.getTime())) lines.push(`${field}: ${at.toISOString()}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const { mode, baseUrl } = readBackfillOptions(process.argv.slice(2));
  const cookie = process.env['RINKUZU_ADMIN_COOKIE'];
  if (!cookie) throw new Error('RINKUZU_ADMIN_COOKIE (an admin session cookie) is required');
  const origin = new URL(baseUrl).origin;
  const response = await fetch(new URL(ROUTE, origin), {
    method: 'POST',
    headers: {
      cookie,
      origin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    throw new Error(`Backfill request failed with HTTP ${response.status}`);
  }
  process.stdout.write(formatBackfillReport(payload.data));
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
