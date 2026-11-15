#!/usr/bin/env node
// RIN-1678: count the documents, RSC requests and server renders one page view costs.
//
//   node scripts/perf/count-server-renders.mjs --base http://localhost:3000 \
//     --topic <seeded-topic-slug> --slug <seeded-quiz-slug> [--storage-state file.json] [--json]
//
// Run it against a local `next build` + `next start` (CI fixture env, throwaway Mongo with the
// e2e seed). It refuses any host that is not localhost: never point it at production or a
// preview (RIN-1674 traffic budget). Signed out, 1440 px, User-Agent tagged rinkuzu-agent/frontend.
//
// Per page: load, `load` + 2 s, scroll to the bottom in steps, wait 2 s. Counted:
//   documents  navigations (resourceType "document")
//   rsc        requests carrying the `RSC: 1` header or an `_rsc` query (prefetches and fetches)
//   renders    document + RSC responses that were NOT served from a cache or a prerendered file.
//              `next start` marks a cached/prerendered response with `x-nextjs-cache: HIT|STALE`
//              (ISR, `●`) or `x-nextjs-prerender: 1` (static `○`); anything else ran the server.
//              Run with --headers to print the cache headers of every counted response and
//              confirm this against the Next version in use.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const flag = (name) => args.includes(`--${name}`);

const base = opt('base', 'http://localhost:3000').replace(/\/$/, '');
const topic = opt('topic');
const slug = opt('slug');
const storageState = opt('storage-state');
const locale = opt('locale', 'vi');
const AGENT_TAG = 'rinkuzu-agent/frontend';

const host = new URL(base).hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
  console.error(`Refusing ${host}: run this against a local build only (RIN-1674).`);
  process.exit(2);
}

const pages = storageState
  ? [`/${locale}/explore`]
  : [
      `/${locale}`,
      `/${locale}/explore`,
      ...(topic ? [`/${locale}/explore/${topic}`] : []),
      ...(slug ? [`/${locale}/quiz/${slug}`] : []),
      `/${locale}/blog`,
    ];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isCached(headers) {
  const cache = (headers['x-nextjs-cache'] ?? '').toUpperCase();
  return cache === 'HIT' || cache === 'STALE' || headers['x-nextjs-prerender'] === '1';
}

async function measure(context, path) {
  const page = await context.newPage();
  const stats = { path, documents: 0, rsc: 0, renders: 0 };
  const pending = [];
  page.on('response', (response) => {
    const request = response.request();
    const isDocument = request.resourceType() === 'document';
    const url = new URL(request.url());
    const isRsc = request.headers()['rsc'] === '1' || url.searchParams.has('_rsc');
    if (!isDocument && !isRsc) return;
    if (url.origin !== base) return;
    pending.push(
      response.allHeaders().then((headers) => {
        if (isDocument) stats.documents += 1;
        if (isRsc) stats.rsc += 1;
        const cached = isCached(headers);
        if (!cached) stats.renders += 1;
        if (flag('headers')) {
          console.error(
            `${isDocument ? 'doc' : 'rsc'} ${url.pathname}${url.search} ${response.status()} ` +
              `x-nextjs-cache=${headers['x-nextjs-cache'] ?? '-'} ` +
              `x-nextjs-prerender=${headers['x-nextjs-prerender'] ?? '-'} cached=${cached}`,
          );
        }
      }),
    );
  });
  await page.goto(`${base}${path}`, { waitUntil: 'load' });
  await wait(2000);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.mouse.wheel(0, 600);
    await wait(150);
  }
  await wait(2000);
  await Promise.all(pending);
  await page.close();
  return stats;
}

const browser = await chromium.launch({ channel: process.env['PW_CHANNEL'] || undefined });
const probe = await browser.newPage();
const defaultUa = await probe.evaluate(() => navigator.userAgent);
await probe.close();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: `${defaultUa} ${AGENT_TAG}`,
  ...(storageState ? { storageState } : {}),
});

const rows = [];
for (const path of pages) rows.push(await measure(context, path));
await browser.close();

const total = rows.reduce(
  (sum, row) => ({
    path: 'TOTAL',
    documents: sum.documents + row.documents,
    rsc: sum.rsc + row.rsc,
    renders: sum.renders + row.renders,
  }),
  { path: 'TOTAL', documents: 0, rsc: 0, renders: 0 },
);

if (flag('json')) {
  console.log(JSON.stringify({ rows, total }, null, 2));
} else {
  console.log('| page | documents | rsc requests | server renders |');
  console.log('|---|---:|---:|---:|');
  for (const row of [...rows, total]) {
    console.log(`| ${row.path} | ${row.documents} | ${row.rsc} | ${row.renders} |`);
  }
}
