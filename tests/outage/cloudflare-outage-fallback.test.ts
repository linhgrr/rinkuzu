import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOutageWorker,
  type ColoCache,
  type OutageEnvironment,
} from '../../infra/cloudflare/outage-fallback/src/index';
import { renderOutagePage } from '../../infra/cloudflare/outage-fallback/src/outage-page';

const SITE = 'https://www.rinkuzu.app';
const NOTIFY_TOKEN = 'test-outage-notify-token-that-is-long-enough';
const EDGE_SECRET = 'test-edge-shared-secret-that-is-long-enough';
const ENV: OutageEnvironment = {
  EDGE_SHARED_SECRET: EDGE_SECRET,
  OUTAGE_NOTIFY_TOKEN: NOTIFY_TOKEN,
  NOTIFY_API_URL: 'https://api.example.test/api/internal/outage-notify',
};

function envWithout(key: keyof OutageEnvironment): OutageEnvironment {
  const env = { ...ENV };
  delete env[key];
  return env;
}

type Fetcher = (request: Request) => Promise<Response>;

class FakeCache implements ColoCache {
  readonly entries = new Map<string, Response>();
  async match(key: Request): Promise<Response | undefined> {
    return this.entries.get(key.url)?.clone();
  }
  async put(key: Request, response: Response): Promise<void> {
    this.entries.set(key.url, response);
  }
}

function setup(origin: Fetcher, options: { now?: () => number; cache?: ColoCache } = {}) {
  const pending: Promise<unknown>[] = [];
  const cache = options.cache ?? new FakeCache();
  const fetcher = vi.fn(origin);
  const worker = createOutageWorker({
    fetch: fetcher,
    cache: () => cache,
    now: options.now ?? (() => 1_800_000_000_000),
  });
  const run = async (request: Request, env: OutageEnvironment = ENV) => {
    const response = await worker.fetch(request, env, {
      waitUntil: (promise) => {
        pending.push(promise);
      },
    });
    await Promise.all(pending);
    return response;
  };
  return { run, fetcher, cache };
}

function navigation(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${SITE}${path}`, {
    headers: { accept: 'text/html,application/xhtml+xml', ...headers },
  });
}

function notifyPost(
  fields: Record<string, string>,
  headers: Record<string, string> = { 'sec-fetch-site': 'same-origin', origin: SITE },
): Request {
  return new Request(`${SITE}/__rinkuzu/notify`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

function expectOutageHeaders(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('3600');
  expect(response.headers.get('x-robots-tag')).toBe('noindex');
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '');
  expect(Number(maxAge?.[1])).toBeLessThanOrEqual(60);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('outage fallback: origin down', () => {
  it.each([402, 500, 503])('serves the branded page when the origin answers %i', async (status) => {
    const { run } = setup(
      async () =>
        new Response('DEPLOYMENT_DISABLED', {
          status,
          headers: { 'x-vercel-id': 'iad1::abc', 'content-type': 'text/plain' },
        }),
    );

    const response = await run(navigation('/en/quizzes'));

    expectOutageHeaders(response);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('x-vercel-id')).toBeNull();
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('Rinkuzu is taking a short break');
    expect(html).not.toContain('DEPLOYMENT_DISABLED');
  });

  it('serves the page when the origin sends no headers within 8 s', async () => {
    vi.useFakeTimers();
    const { run } = setup(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(request.signal.reason));
        }),
    );

    const pending = run(navigation('/vi/x'));
    await vi.advanceTimersByTimeAsync(7_999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;

    expectOutageHeaders(response);
    expect(await response.text()).toContain('Rinkuzu đang tạm nghỉ một chút');
  });

  it('serves the page when the origin fetch throws', async () => {
    const { run } = setup(async () => {
      throw new TypeError('network connection lost');
    });

    const response = await run(navigation('/'));

    expectOutageHeaders(response);
  });

  it.each([
    ['/vi/x', {}, 'vi'],
    ['/vi', {}, 'vi'],
    ['/en/x', { 'accept-language': 'vi-VN,vi;q=0.9' }, 'en'],
    ['/', { 'accept-language': 'vi' }, 'vi'],
    ['/', { 'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8' }, 'vi'],
    ['/', { 'accept-language': 'en-US' }, 'en'],
    ['/', { 'accept-language': 'en-US,vi;q=0.9' }, 'en'],
    ['/', {}, 'en'],
    ['/video', { 'accept-language': 'en' }, 'en'],
  ])('picks the locale for %s %o -> %s', async (path, headers, locale) => {
    const { run } = setup(async () => new Response(null, { status: 402 }));

    const html = await (await run(navigation(path, headers))).text();

    expect(html).toContain(`<html lang="${locale}">`);
  });

  it('answers /api requests with a 503 that is not HTML', async () => {
    const { run } = setup(async () => new Response('down', { status: 402 }));

    const response = await run(
      new Request(`${SITE}/api/quizzes`, { headers: { accept: 'text/html,*/*' } }),
    );

    expectOutageHeaders(response);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.json()).toMatchObject({ success: false });
  });

  it('answers other non-navigation requests with plain text', async () => {
    const { run } = setup(async () => new Response('down', { status: 402 }));

    const response = await run(new Request(`${SITE}/_next/static/chunk.js`));

    expectOutageHeaders(response);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('answers HEAD navigations with headers only', async () => {
    const { run } = setup(async () => new Response(null, { status: 402 }));

    const response = await run(
      new Request(`${SITE}/en`, { method: 'HEAD', headers: { accept: 'text/html' } }),
    );

    expectOutageHeaders(response);
    expect(await response.text()).toBe('');
  });

  it('passes an app-level 5xx on an API route through untouched and keeps the site up', async () => {
    const appError = JSON.stringify({ success: false, error: { code: 'upstream_failed' } });
    const { run, fetcher } = setup(
      async () =>
        new Response(appError, { status: 503, headers: { 'content-type': 'application/json' } }),
    );

    const response = await run(new Request(`${SITE}/api/adaptive/x`));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(appError);

    await run(navigation('/en'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    [500, 'FUNCTION_INVOCATION_FAILED'],
    [504, 'FUNCTION_INVOCATION_TIMEOUT'],
  ])(
    'passes a function-level %i %s on an API route through and keeps the site up',
    async (status, code) => {
      const { run, fetcher, cache } = setup(
        async () => new Response(code, { status, headers: { 'x-vercel-error': code } }),
      );

      const response = await run(new Request(`${SITE}/api/x`));
      expect(response.status).toBe(status);
      expect(response.headers.get('x-vercel-error')).toBe(code);
      expect(await response.text()).toBe(code);
      expect((cache as FakeCache).entries.size).toBe(0);

      await run(navigation('/en'));
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    [500, 'FUNCTION_INVOCATION_FAILED'],
    [504, 'FUNCTION_INVOCATION_TIMEOUT'],
  ])(
    'serves the page for a function-level %i %s on a navigation without setting the flag',
    async (status, code) => {
      const { run, cache } = setup(
        async () => new Response(code, { status, headers: { 'x-vercel-error': code } }),
      );

      const response = await run(navigation('/en/quizzes'));

      expectOutageHeaders(response);
      expect(await response.text()).not.toContain(code);
      expect((cache as FakeCache).entries.size).toBe(0);
    },
  );
});

describe('outage fallback: down flag', () => {
  it('skips the origin for 30 s after a failure, then probes again', async () => {
    let clock = 1_800_000_000_000;
    let originStatus = 402;
    const { run, fetcher } = setup(async () => new Response('x', { status: originStatus }), {
      now: () => clock,
    });

    await run(navigation('/en'));
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock += 29_000;
    const fast = await run(navigation('/en/quizzes'));
    expectOutageHeaders(fast);
    const api = await run(new Request(`${SITE}/api/x`));
    expect(api.status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock += 1_001;
    originStatus = 200;
    const healthy = await run(navigation('/en'));
    expect(healthy.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not set the flag for a healthy response', async () => {
    const { run, cache } = setup(async () => new Response('ok'));

    await run(navigation('/en'));

    expect((cache as FakeCache).entries.size).toBe(0);
  });

  it('stores the flag with a 30 s cache lifetime', async () => {
    const { run, cache } = setup(async () => new Response(null, { status: 402 }));

    await run(navigation('/en'));

    const [entry] = [...(cache as FakeCache).entries.values()];
    expect(entry?.headers.get('cache-control')).toBe('max-age=30');
  });

  it.each([
    ['402 DEPLOYMENT_DISABLED', 402, { 'x-vercel-error': 'DEPLOYMENT_DISABLED' }],
    ['503 DEPLOYMENT_PAUSED', 503, { 'x-vercel-error': 'DEPLOYMENT_PAUSED' }],
    ['404 DEPLOYMENT_NOT_FOUND', 404, { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }],
    ['Cloudflare 522', 522, {}],
    ['Cloudflare 520', 520, {}],
    ['Cloudflare 530', 530, {}],
    ['502 without x-vercel-error', 502, {}],
    ['504 without x-vercel-error', 504, {}],
  ])('sets the flag for %s', async (_label, status, headers) => {
    const { run, fetcher, cache } = setup(async () => new Response('x', { status, headers }));

    const api = await run(new Request(`${SITE}/api/x`));
    expect(api.status).toBe(503);
    expectOutageHeaders(api);
    expect((cache as FakeCache).entries.size).toBe(1);

    await run(navigation('/en'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['500 without x-vercel-error', 500, {}],
    ['503 without x-vercel-error', 503, {}],
    ['502 NO_RESPONSE_FROM_FUNCTION', 502, { 'x-vercel-error': 'NO_RESPONSE_FROM_FUNCTION' }],
    ['429 FUNCTION_THROTTLED', 429, { 'x-vercel-error': 'FUNCTION_THROTTLED' }],
  ])('does not set the flag for %s', async (_label, status, headers) => {
    const { run, cache } = setup(async () => new Response('x', { status, headers }));

    await run(navigation('/en'));
    await run(new Request(`${SITE}/api/x`));

    expect((cache as FakeCache).entries.size).toBe(0);
  });
});

describe('outage fallback: healthy origin', () => {
  it.each([
    [200, 'hello'],
    [301, null],
    [404, 'not found'],
  ])('returns the origin %i response unchanged', async (status, body) => {
    const originResponse = new Response(body, {
      status,
      headers: {
        'set-cookie': 'session=abc; Path=/; HttpOnly',
        'x-custom': 'kept',
        ...(status === 301 ? { location: '/en' } : {}),
      },
    });
    const { run } = setup(async () => originResponse);

    const response = await run(navigation('/'));

    expect(response).toBe(originResponse);
    expect(response.status).toBe(status);
    expect(response.headers.get('set-cookie')).toBe('session=abc; Path=/; HttpOnly');
    expect(response.headers.get('x-custom')).toBe('kept');
  });

  it('forwards method, body and headers plus only the two edge headers', async () => {
    let received: Request | undefined;
    let receivedBody = '';
    const { run } = setup(async (request) => {
      received = request;
      receivedBody = await request.text();
      return new Response('ok');
    });

    await run(
      new Request(`${SITE}/api/thing?x=1`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.7',
          'x-test': 'yes',
          'x-rinkuzu-edge': 'forged',
          'x-rinkuzu-client-ip': '198.51.100.1',
        },
        body: '{"a":1}',
      }),
    );

    expect(received?.method).toBe('PUT');
    expect(received?.url).toBe(`${SITE}/api/thing?x=1`);
    expect(received?.redirect).toBe('manual');
    expect(receivedBody).toBe('{"a":1}');
    expect(Object.fromEntries(received?.headers ?? [])).toEqual({
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.7',
      'x-test': 'yes',
      'x-rinkuzu-edge': EDGE_SECRET,
      'x-rinkuzu-client-ip': '203.0.113.7',
    });
  });

  it('drops forged edge headers when it has no secret or client IP', async () => {
    let received: Request | undefined;
    const { run } = setup(async (request) => {
      received = request;
      return new Response('ok');
    });

    await run(
      new Request(`${SITE}/`, {
        headers: { 'x-rinkuzu-edge': 'forged', 'x-rinkuzu-client-ip': '198.51.100.1' },
      }),
      envWithout('EDGE_SHARED_SECRET'),
    );

    expect(received?.headers.get('x-rinkuzu-edge')).toBeNull();
    expect(received?.headers.get('x-rinkuzu-client-ip')).toBeNull();
  });

  it('does not time out a slow non-navigation request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const { run } = setup(
      (request) =>
        new Promise<Response>((resolve) => {
          signal = request.signal;
          setTimeout(() => resolve(new Response('slow but fine')), 20_000);
        }),
    );

    const pending = run(new Request(`${SITE}/api/quiz-drafts`, { method: 'POST', body: 'x' }));
    await vi.advanceTimersByTimeAsync(20_000);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(signal?.aborted).toBe(false);
  });

  it('clears the navigation timer once headers arrive, so a long stream is not cut', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const { run } = setup(async (request) => {
      signal = request.signal;
      return new Response('streaming');
    });

    await run(navigation('/en'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(signal?.aborted).toBe(false);
  });
});

describe('outage fallback: fail open', () => {
  it('passes the request through when the worker itself throws', async () => {
    const brokenCache: ColoCache = {
      match: async () => {
        throw new Error('cache unavailable');
      },
      put: async () => undefined,
    };
    const originResponse = new Response('origin');
    const { run, fetcher } = setup(async () => originResponse, { cache: brokenCache });

    const response = await run(navigation('/en'));

    expect(response).toBe(originResponse);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('outage fallback: notify form', () => {
  const validFields = {
    email: 'Learner@Example.com',
    locale: 'vi',
    path: '/vi/quizzes',
    utm_source: 'threads',
    utm_medium: 'social',
    utm_campaign: 'w46',
    entry: 'hub',
  };

  function apiStub(status: number) {
    return vi.fn(async (request: Request) => {
      if (request.url.startsWith('https://api.example.test/')) {
        return new Response(JSON.stringify({ success: status === 202 }), { status });
      }
      throw new Error(`unexpected origin call ${request.url}`);
    });
  }

  it('posts the contract to the API and renders success', async () => {
    let apiRequest: Request | undefined;
    let apiBody: unknown;
    const { run } = setup(async (request) => {
      apiRequest = request;
      apiBody = await request.json();
      return new Response('{}', { status: 202 });
    });

    const response = await run(
      notifyPost(validFields, {
        'sec-fetch-site': 'same-origin',
        origin: SITE,
        'cf-connecting-ip': '203.0.113.9',
      }),
    );

    expect(apiRequest?.method).toBe('POST');
    expect(apiRequest?.url).toBe(ENV.NOTIFY_API_URL);
    expect(apiRequest?.headers.get('x-outage-notify-token')).toBe(NOTIFY_TOKEN);
    expect(apiRequest?.headers.get('x-client-ip')).toBe('203.0.113.9');
    expect(apiRequest?.headers.get('content-type')).toBe('application/json');
    expect(apiBody).toEqual({
      email: 'learner@example.com',
      locale: 'vi',
      path: '/vi/quizzes',
      utm: { source: 'threads', medium: 'social', campaign: 'w46', content: null, term: null },
      entry: 'hub',
      consent_text: expect.stringContaining('đúng một email'),
      consent_version: expect.any(String),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const html = await response.text();
    expect(html).toContain('Đã ghi nhận. Hẹn gặp lại bạn sớm!');
    expect(html).not.toContain(NOTIFY_TOKEN);
  });

  it('uses the default API URL when none is configured', async () => {
    const { run, fetcher } = setup(async () => new Response('{}', { status: 202 }));

    await run(notifyPost(validFields), envWithout('NOTIFY_API_URL'));

    expect(fetcher.mock.calls[0]?.[0].url).toBe(
      'https://api.rinkuzu.app/api/internal/outage-notify',
    );
  });

  it.each([
    [422, 422, 'Email này chưa đúng'],
    [429, 429, 'Bạn đã gửi nhiều lần. Thử lại sau nhé.'],
    [500, 503, 'Không gửi được, thử lại sau.'],
    [401, 503, 'Không gửi được, thử lại sau.'],
  ])('maps API %i to a %i page with the right message', async (apiStatus, status, message) => {
    const { run } = setup(apiStub(apiStatus));

    const response = await run(notifyPost(validFields));

    expect(response.status).toBe(status);
    const html = await response.text();
    expect(html).toContain(message);
    expect(html).not.toContain(NOTIFY_TOKEN);
  });

  it('marks the field invalid and keeps the hidden context for a retry', async () => {
    const { run } = setup(apiStub(422));

    const html = await (await run(notifyPost(validFields))).text();

    expect(html).toMatch(/aria-invalid="true"/);
    expect(html).toMatch(/aria-describedby="email-error"/);
    expect(html).toMatch(/autofocus/);
    expect(html).toContain('value="/vi/quizzes"');
    expect(html).toContain('value="threads"');
  });

  it('renders the unavailable state when the API times out', async () => {
    vi.useFakeTimers();
    const { run } = setup(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(request.signal.reason));
        }),
    );

    const pending = run(notifyPost(validFields));
    await vi.advanceTimersByTimeAsync(8_000);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Không gửi được, thử lại sau.');
  });

  it('rejects a malformed email without calling the API', async () => {
    const { run, fetcher } = setup(apiStub(202));

    const response = await run(notifyPost({ ...validFields, email: 'not-an-email' }));

    expect(response.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('renders unavailable without calling the API when the token is not set', async () => {
    const { run, fetcher } = setup(apiStub(202));

    const response = await run(notifyPost(validFields), envWithout('OUTAGE_NOTIFY_TOKEN'));

    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers a script submit with JSON', async () => {
    const { run } = setup(apiStub(202));

    const response = await run(
      notifyPost(validFields, { 'sec-fetch-site': 'same-origin', accept: 'application/json' }),
    );

    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.json()).toEqual({ state: 'success' });
  });

  it('clamps fields to the API limits and falls back to a safe path', async () => {
    let apiBody: Record<string, unknown> = {};
    const { run } = setup(async (request) => {
      apiBody = (await request.json()) as Record<string, unknown>;
      return new Response('{}', { status: 202 });
    });

    await run(
      notifyPost({
        email: 'a@example.com',
        locale: 'fr',
        path: 'https://evil.example/x',
        utm_source: 's'.repeat(300),
        entry: 'e'.repeat(100),
      }),
    );

    expect(apiBody['locale']).toBe('en');
    expect(apiBody['path']).toBe('/');
    expect((apiBody['utm'] as { source: string }).source).toHaveLength(128);
    expect(apiBody['entry']).toHaveLength(64);
  });

  it.each([
    ['cross-site fetch metadata', { 'sec-fetch-site': 'cross-site', origin: SITE }],
    ['foreign origin', { origin: 'https://evil.example' }],
    ['no origin information', {}],
  ])('refuses a post with %s', async (_label, headers) => {
    const { run, fetcher } = setup(apiStub(202));

    const response = await run(notifyPost(validFields, headers));

    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts a same-host Origin without fetch metadata', async () => {
    const { run } = setup(apiStub(202));

    const response = await run(notifyPost(validFields, { origin: SITE }));

    expect(response.status).toBe(200);
  });

  it('refuses other methods on the notify path and never forwards it to the origin', async () => {
    const { run, fetcher } = setup(async () => new Response('origin'));

    const response = await run(navigation('/__rinkuzu/notify'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('outage page', () => {
  it.each(['vi', 'en'] as const)('stays self-contained and under 20 KB (%s)', (locale) => {
    const html = renderOutagePage({ locale, path: '/', query: {}, state: 'default' });

    expect(new TextEncoder().encode(html).byteLength).toBeLessThan(20 * 1024);
    expect(html).not.toMatch(/<link\b|<script\s+src|https?:\/\/(?!www\.w3\.org)/i);
    expect(html).toContain('action="/__rinkuzu/notify"');
    expect(html).toContain('method="post"');
    expect(html).toContain('privacy@rinkuzu.app');
  });

  it('escapes everything it echoes back', () => {
    const html = renderOutagePage({
      locale: 'en',
      path: '/"><script>alert(1)</script>',
      query: { utm_source: '"><img src=x onerror=alert(1)>' },
      email: '"><b>x</b>',
      state: 'invalid',
    });

    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>x</b>');
  });

  it('never mentions the hosting or billing cause', () => {
    for (const locale of ['vi', 'en'] as const) {
      const html = renderOutagePage({ locale, path: '/', query: {}, state: 'default' });
      expect(html).not.toMatch(/vercel|billing|payment|thanh toán/i);
    }
  });
});
