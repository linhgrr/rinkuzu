import { describe, expect, it, vi } from 'vitest';

import { INDEXNOW_KEY, postIndexNow } from '@/lib/seo/indexnow-core';
import {
  findPreviousProductionDeployTime,
  isProductionSuccess,
  parseSitemap,
  run,
  selectChangedUrls,
} from '../../scripts/indexnow-deploy.mjs';

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url>
<loc>https://www.rinkuzu.app/vi</loc>
<xhtml:link rel="alternate" hreflang="en" href="https://www.rinkuzu.app/en" />
<lastmod>2026-11-10T00:00:00.000Z</lastmod>
</url>
<url>
<loc>https://www.rinkuzu.app/en/blog/new-post</loc>
<lastmod>2026-11-09T00:00:00.000Z</lastmod>
</url>
<url>
<loc>https://www.rinkuzu.app/en/about</loc>
<lastmod>2026-11-03T00:00:00.000Z</lastmod>
</url>
<url>
<loc>https://www.rinkuzu.app/en/terms?a=1&amp;b=2</loc>
<lastmod>2026-11-10T00:00:00.000Z</lastmod>
</url>
<url>
<loc>https://www.rinkuzu.app/en/no-lastmod</loc>
</url>
</urlset>`;

const productionEvent = {
  deployment_status: { state: 'success' },
  deployment: { id: 300, environment: 'Production', created_at: '2026-11-10T15:39:37Z' },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Routes the script's requests: GitHub deployments, the sitemap, IndexNow. */
function fakeNetwork(indexNowStatuses: Array<number | 'network-error'> = [200]) {
  const indexNowBodies: unknown[] = [];
  const statuses = [...indexNowStatuses];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === 'https://www.rinkuzu.app/sitemap.xml') return new Response(SITEMAP);
    if (url.startsWith('https://api.github.com/repos/acme/web/deployments?')) {
      return json([
        { id: 300, created_at: '2026-11-10T15:39:37Z' },
        { id: 200, created_at: '2026-11-09T10:00:00Z' },
        { id: 100, created_at: '2026-11-01T10:00:00Z' },
      ]);
    }
    if (url === 'https://api.github.com/repos/acme/web/deployments/200/statuses?per_page=10') {
      return json([{ state: 'failure', created_at: '2026-11-09T10:05:00Z' }]);
    }
    if (url === 'https://api.github.com/repos/acme/web/deployments/100/statuses?per_page=10') {
      return json([{ state: 'success', created_at: '2026-11-08T10:05:00Z' }]);
    }
    if (url === 'https://api.indexnow.org/indexnow') {
      indexNowBodies.push(JSON.parse(String(init?.body)));
      const next = statuses.shift() ?? 200;
      if (next === 'network-error') throw new TypeError('fetch failed');
      return new Response(null, { status: next });
    }
    throw new Error(`unexpected request ${url}`);
  });
  const fetchFn: typeof fetch = fetchMock;
  return { fetch: fetchFn, fetchMock, indexNowBodies };
}

function deps(
  network: ReturnType<typeof fakeNetwork>,
  overrides: { argv?: string[]; event?: unknown; env?: Record<string, string> } = {},
) {
  const lines: Array<Record<string, unknown>> = [];
  const hasEvent = 'event' in overrides;
  return {
    lines,
    deps: {
      argv: overrides.argv ?? [],
      env: {
        ...(hasEvent ? { GITHUB_EVENT_PATH: '/fake/event.json' } : {}),
        GITHUB_REPOSITORY: 'acme/web',
        GITHUB_TOKEN: 'fake-token',
        ...overrides.env,
      },
      fetch: network.fetch,
      post: postIndexNow,
      log: (line: Record<string, unknown>) => lines.push(line),
      now: () => new Date('2026-11-10T16:00:00Z'),
      readEvent: () => overrides.event,
    },
  };
}

describe('isProductionSuccess', () => {
  it('accepts only a success on the Production environment', () => {
    expect(isProductionSuccess(productionEvent)).toBe(true);
    expect(
      isProductionSuccess({ ...productionEvent, deployment: { environment: 'Preview' } }),
    ).toBe(false);
    expect(
      isProductionSuccess({ ...productionEvent, deployment_status: { state: 'pending' } }),
    ).toBe(false);
    expect(isProductionSuccess(null)).toBe(false);
  });
});

describe('sitemap selection', () => {
  it('parses loc and lastmod, unescaping XML entities', () => {
    const entries = parseSitemap(SITEMAP);
    expect(entries).toHaveLength(5);
    expect(entries[3]?.loc).toBe('https://www.rinkuzu.app/en/terms?a=1&b=2');
    expect(entries[4]?.lastmod).toBeNull();
  });

  it('keeps pages whose lastmod day is on or after the day of the previous deploy', () => {
    const entries = parseSitemap(SITEMAP);
    // An afternoon deploy still counts a page whose lastmod is that same day.
    expect(selectChangedUrls(entries, new Date('2026-11-09T15:00:00Z'))).toEqual([
      'https://www.rinkuzu.app/vi',
      'https://www.rinkuzu.app/en/blog/new-post',
      'https://www.rinkuzu.app/en/terms?a=1&b=2',
    ]);
    expect(selectChangedUrls(entries, new Date('2026-11-11T00:00:00Z'))).toEqual([]);
  });
});

describe('findPreviousProductionDeployTime', () => {
  it('returns the go-live time of the newest older production deployment that succeeded', async () => {
    const network = fakeNetwork();
    const since = await findPreviousProductionDeployTime({
      repo: 'acme/web',
      currentDeploymentId: 300,
      currentCreatedAt: new Date('2026-11-10T15:39:37Z'),
      token: 'fake-token',
      fetch: network.fetch,
    });
    expect(since?.toISOString()).toBe('2026-11-08T10:05:00.000Z');
    const [, init] = network.fetchMock.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fake-token');
  });

  it('returns null when the GitHub API fails', async () => {
    const since = await findPreviousProductionDeployTime({
      repo: 'acme/web',
      currentDeploymentId: 300,
      currentCreatedAt: null,
      fetch: async () => new Response('nope', { status: 403 }),
    });
    expect(since).toBeNull();
  });
});

describe('run', () => {
  it('pings the URLs changed since the previous production deploy, with the app key', async () => {
    const network = fakeNetwork([202]);
    const { deps: runDeps, lines } = deps(network, { event: productionEvent });

    await expect(run(runDeps)).resolves.toBe(0);

    expect(network.indexNowBodies).toHaveLength(1);
    expect(network.indexNowBodies[0]).toEqual({
      host: 'www.rinkuzu.app',
      key: INDEXNOW_KEY,
      keyLocation: `https://www.rinkuzu.app/${INDEXNOW_KEY}.txt`,
      // The query-string URL is dropped by the shared normaliser.
      urlList: ['https://www.rinkuzu.app/vi', 'https://www.rinkuzu.app/en/blog/new-post'],
    });
    expect(lines).toEqual([
      {
        event: 'indexnow',
        urlCount: 2,
        status: 202,
        attempt: 1,
        source: 'deploy',
        since: '2026-11-08',
        sinceSource: 'previous-deploy',
      },
    ]);
  });

  it('never pings for a preview deployment', async () => {
    const network = fakeNetwork();
    const { deps: runDeps, lines } = deps(network, {
      event: {
        ...productionEvent,
        deployment: { ...productionEvent.deployment, environment: 'Preview' },
      },
    });

    await expect(run(runDeps)).resolves.toBe(0);

    expect(network.fetchMock).not.toHaveBeenCalled();
    expect(lines).toEqual([
      { event: 'indexnow-deploy', skipped: 'not-a-production-success', urlCount: 0 },
    ]);
  });

  it('exits 0 when IndexNow fails twice', async () => {
    const network = fakeNetwork(['network-error', 503]);
    const { deps: runDeps, lines } = deps(network, { event: productionEvent });

    await expect(run(runDeps)).resolves.toBe(0);

    expect(network.indexNowBodies).toHaveLength(2);
    expect(lines[0]).toMatchObject({ event: 'indexnow', status: 503, attempt: 2 });
  });

  it('exits 0 when the post itself throws', async () => {
    const network = fakeNetwork();
    const { deps: runDeps } = deps(network, { event: productionEvent });
    runDeps.post = async () => {
      throw new Error('boom');
    };
    await expect(run(runDeps)).resolves.toBe(0);
  });

  it('prints only the selected count in --dry-run and never pings', async () => {
    const network = fakeNetwork();
    const { deps: runDeps, lines } = deps(network, {
      argv: ['--dry-run', '--since', '2026-11-09'],
    });

    await expect(run(runDeps)).resolves.toBe(0);

    expect(network.indexNowBodies).toHaveLength(0);
    expect(lines).toEqual([
      {
        event: 'indexnow-deploy',
        dryRun: true,
        since: '2026-11-09',
        sinceSource: 'argument',
        urlCount: 3,
      },
    ]);
  });

  it('falls back to the last 24 hours without an event or --since', async () => {
    const network = fakeNetwork();
    const { deps: runDeps, lines } = deps(network, { argv: ['--dry-run'] });
    await run(runDeps);
    expect(lines[0]).toMatchObject({ since: '2026-11-09', sinceSource: 'fallback-24h' });
  });

  it('exits 0 without pinging when the sitemap is unavailable or --since is invalid', async () => {
    const down: typeof fetch = async () => new Response('down', { status: 503 });
    const network = { ...fakeNetwork(), fetch: down };
    const { deps: unavailable, lines } = deps(network, { argv: ['--since', '2026-11-01'] });
    await expect(run(unavailable)).resolves.toBe(0);
    expect(lines).toEqual([
      { event: 'indexnow-deploy', skipped: 'sitemap-unavailable', urlCount: 0 },
    ]);

    const { deps: invalid, lines: invalidLines } = deps(fakeNetwork(), {
      argv: ['--since', 'soon'],
    });
    await expect(run(invalid)).resolves.toBe(0);
    expect(invalidLines[0]).toMatchObject({ skipped: 'invalid-since' });
  });

  it('reports zero URLs without calling IndexNow when nothing changed', async () => {
    const network = fakeNetwork();
    const { deps: runDeps, lines } = deps(network, { argv: ['--since', '2026-12-01'] });
    await run(runDeps);
    expect(network.indexNowBodies).toHaveLength(0);
    expect(lines[0]).toMatchObject({ urlCount: 0, status: null });
  });
});
