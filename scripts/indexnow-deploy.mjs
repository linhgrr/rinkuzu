/**
 * Post-deploy IndexNow ping (RIN-1501, spec RIN-1496 AC 2).
 *
 * Blog posts and static pages change only through a deploy, so the event hooks
 * of RIN-1500 never see them. After a production deploy this reads the live
 * sitemap, keeps the URLs whose `lastmod` falls on or after the previous
 * successful production deployment, and POSTs them to IndexNow in one call
 * through the same client the app uses (`src/lib/seo/indexnow-core.ts`: same
 * key, host, keyLocation, 5 s timeout and one retry).
 *
 *   node scripts/indexnow-deploy.mjs                 # in the workflow: reads the event
 *   node scripts/indexnow-deploy.mjs --since 2026-11-01 --dry-run
 *
 * It always exits 0: IndexNow is a hint to search engines, never a reason to
 * fail a deploy. Output is one JSON line with counts and status, never URLs.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const SITEMAP_URL = 'https://www.rinkuzu.app/sitemap.xml';
const GITHUB_API = 'https://api.github.com';
const PRODUCTION_ENVIRONMENT = 'Production';
const REQUEST_TIMEOUT_MS = 10_000;
/** Without a previous production deployment, look back one day. */
const FALLBACK_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Production deployments to look through for the previous success. */
const DEPLOYMENT_PAGE_SIZE = 20;

/**
 * True only for a successful deployment to Vercel's Production environment.
 * Preview deployments, and every state other than success, never ping.
 *
 * @param {unknown} event the `deployment_status` webhook payload
 * @returns {boolean}
 */
export function isProductionSuccess(event) {
  if (!event || typeof event !== 'object') return false;
  const payload = /** @type {Record<string, any>} */ (event);
  return (
    payload.deployment_status?.state === 'success' &&
    payload.deployment?.environment === PRODUCTION_ENVIRONMENT
  );
}

/**
 * The `<loc>` and `<lastmod>` of each `<url>` in a sitemap. Entries without a
 * parseable `lastmod` keep `lastmod: null`.
 *
 * @param {string} xml
 * @returns {Array<{ loc: string, lastmod: Date | null }>}
 */
export function parseSitemap(xml) {
  /** @type {Array<{ loc: string, lastmod: Date | null }>} */
  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1] ?? '';
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    const rawLastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(block)?.[1];
    const lastmod = rawLastmod ? new Date(rawLastmod) : null;
    entries.push({
      loc: unescapeXml(loc),
      lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
    });
  }
  return entries;
}

/** @param {string} value */
function unescapeXml(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/**
 * Midnight UTC of the given instant. The sitemap's `lastmod` is a day
 * (RIN-1499 writes `YYYY-MM-DDT00:00:00.000Z`), so the comparison is by day:
 * a page changed in the morning still counts after an afternoon deploy.
 *
 * @param {Date} instant
 * @returns {Date}
 */
export function startOfUtcDay(instant) {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
}

/**
 * URLs whose `lastmod` day is on or after the day of `since`. Entries without
 * a `lastmod` are left out: nothing says they changed.
 *
 * @param {Array<{ loc: string, lastmod: Date | null }>} entries
 * @param {Date} since
 * @returns {string[]}
 */
export function selectChangedUrls(entries, since) {
  const cutoff = startOfUtcDay(since).getTime();
  return entries
    .filter((entry) => entry.lastmod !== null && entry.lastmod.getTime() >= cutoff)
    .map((entry) => entry.loc);
}

/**
 * @param {typeof fetch} doFetch
 * @param {string} url
 * @param {string | undefined} token
 */
async function getGitHubJson(doFetch, url, token) {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await doFetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}

/**
 * When the previous successful production deployment went live: the newest
 * `success` status of the newest Production deployment older than the
 * current one. Null when there is none in the last page or the lookup fails.
 *
 * @param {{ repo: string, currentDeploymentId: number | null, currentCreatedAt: Date | null, token?: string | undefined, fetch: typeof fetch }} input
 * @returns {Promise<Date | null>}
 */
export async function findPreviousProductionDeployTime(input) {
  const base = `${GITHUB_API}/repos/${input.repo}/deployments`;
  try {
    const deployments = await getGitHubJson(
      input.fetch,
      `${base}?environment=${PRODUCTION_ENVIRONMENT}&per_page=${DEPLOYMENT_PAGE_SIZE}`,
      input.token,
    );
    if (!Array.isArray(deployments)) return null;
    for (const deployment of deployments) {
      if (deployment?.id === input.currentDeploymentId) continue;
      const createdAt = new Date(deployment?.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      if (input.currentCreatedAt && createdAt >= input.currentCreatedAt) continue;
      const statuses = await getGitHubJson(
        input.fetch,
        `${base}/${deployment.id}/statuses?per_page=10`,
        input.token,
      );
      const success = Array.isArray(statuses)
        ? statuses.find((status) => status?.state === 'success')
        : undefined;
      if (!success) continue;
      const wentLive = new Date(success.created_at);
      return Number.isNaN(wentLive.getTime()) ? createdAt : wentLive;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The live sitemap, with one retry; null when both attempts fail.
 *
 * @param {typeof fetch} doFetch
 * @returns {Promise<string | null>}
 */
async function fetchSitemap(doFetch) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await doFetch(SITEMAP_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return await response.text();
    } catch {
      // Retried once below, then reported as unavailable.
    }
  }
  return null;
}

/**
 * @typedef {{ event: 'indexnow', urlCount: number, status: number | null, attempt: number }} IndexNowLogLine
 * @typedef {{ outcome: string, status: number | null, attempt: number, urlCount: number }} IndexNowResult
 * @typedef {(urls: readonly string[], deps: { fetch: typeof fetch, enabled: boolean, log: (line: IndexNowLogLine) => void }) => Promise<IndexNowResult>} PostIndexNow
 * @typedef {{
 *   argv: string[],
 *   env: Record<string, string | undefined>,
 *   fetch: typeof fetch,
 *   post: PostIndexNow,
 *   log: (line: Record<string, unknown>) => void,
 *   now: () => Date,
 *   readEvent: (path: string) => unknown,
 * }} RunDeps
 */

/**
 * Selects and pings. Returns the exit code, which is always 0.
 *
 * @param {RunDeps} deps
 * @returns {Promise<number>}
 */
export async function run(deps) {
  const { values } = parseArgs({
    args: deps.argv,
    options: {
      since: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });
  const dryRun = values['dry-run'] === true;

  const eventPath = deps.env.GITHUB_EVENT_PATH;
  const event = eventPath ? deps.readEvent(eventPath) : null;
  if (event !== null && !isProductionSuccess(event)) {
    deps.log({ event: 'indexnow-deploy', skipped: 'not-a-production-success', urlCount: 0 });
    return 0;
  }

  /** @type {Date | null} */
  let since = null;
  let sinceSource = 'argument';
  if (values.since) {
    since = new Date(values.since);
    if (Number.isNaN(since.getTime())) {
      deps.log({ event: 'indexnow-deploy', skipped: 'invalid-since', urlCount: 0 });
      return 0;
    }
  } else if (event !== null && deps.env.GITHUB_REPOSITORY) {
    const deployment = /** @type {Record<string, any>} */ (event).deployment ?? {};
    const currentCreatedAt = new Date(deployment.created_at);
    since = await findPreviousProductionDeployTime({
      repo: deps.env.GITHUB_REPOSITORY,
      currentDeploymentId: typeof deployment.id === 'number' ? deployment.id : null,
      currentCreatedAt: Number.isNaN(currentCreatedAt.getTime()) ? null : currentCreatedAt,
      token: deps.env.GITHUB_TOKEN,
      fetch: deps.fetch,
    });
    sinceSource = 'previous-deploy';
  }
  if (since === null) {
    since = new Date(deps.now().getTime() - FALLBACK_LOOKBACK_MS);
    sinceSource = 'fallback-24h';
  }

  const xml = await fetchSitemap(deps.fetch);
  if (xml === null) {
    deps.log({ event: 'indexnow-deploy', skipped: 'sitemap-unavailable', urlCount: 0 });
    return 0;
  }
  const urls = selectChangedUrls(parseSitemap(xml), since);

  const sinceDay = startOfUtcDay(since).toISOString().slice(0, 10);
  if (dryRun) {
    deps.log({
      event: 'indexnow-deploy',
      dryRun: true,
      since: sinceDay,
      sinceSource,
      urlCount: urls.length,
    });
    return 0;
  }
  if (urls.length === 0) {
    deps.log({ event: 'indexnow-deploy', since: sinceDay, sinceSource, urlCount: 0, status: null });
    return 0;
  }

  try {
    await deps.post(urls, {
      fetch: deps.fetch,
      enabled: true,
      log: (line) => deps.log({ ...line, source: 'deploy', since: sinceDay, sinceSource }),
    });
  } catch {
    // postIndexNow never throws; this guard keeps the exit code 0 regardless.
  }
  return 0;
}

/* c8 ignore start -- the CLI wiring; `run` carries the behaviour and its tests. */
async function main() {
  // Node 22.18+ strips the types of this import-free module: the app and the
  // deploy ping send the same key, host, keyLocation, timeout and retry.
  const core = await import(new URL('../src/lib/seo/indexnow-core.ts', import.meta.url).href);
  process.exitCode = await run({
    argv: process.argv.slice(2),
    env: process.env,
    fetch,
    post: core.postIndexNow,
    log: (line) => process.stdout.write(`${JSON.stringify(line)}\n`),
    now: () => new Date(),
    readEvent: (path) => JSON.parse(readFileSync(path, 'utf8')),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify({ event: 'indexnow-deploy', skipped: 'error' })}\n`);
    process.exitCode = 0;
  });
}
/* c8 ignore stop */
