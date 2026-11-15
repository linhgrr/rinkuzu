import {
  CONSENT_VERSION,
  CONTEXT_QUERY_KEYS,
  consentText,
  renderOutagePage,
  type ContextQuery,
  type NotifyState,
  type OutageLocale,
} from './outage-page';

/**
 * Outage fallback in front of rinkuzu.app (RIN-1651, spec RIN-1643).
 *
 * Healthy traffic goes to the origin and comes back untouched: the response
 * object is returned as is, never buffered. When the origin is down the
 * visitor gets a branded 503 page with a "tell me when you are back" form
 * instead of a bare platform error.
 */

export interface OutageEnvironment {
  /** Lets the web trust `x-rinkuzu-client-ip` (see src/lib/client-ip.ts). */
  EDGE_SHARED_SECRET?: string;
  /** Authenticates the Worker to the API's outage-notify endpoint. */
  OUTAGE_NOTIFY_TOKEN?: string;
  NOTIFY_API_URL?: string;
}

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** The subset of the Workers Cache API this Worker uses. */
export interface ColoCache {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
}

export interface OutageDependencies {
  fetch: (request: Request) => Promise<Response>;
  /** Resolved per request: `caches` only exists inside the Workers runtime. */
  cache: () => ColoCache | null;
  now: () => number;
}

const DEFAULT_NOTIFY_API_URL = 'https://api.rinkuzu.app/api/internal/outage-notify';
const NOTIFY_PATH = '/__rinkuzu/notify';
/** Synthetic key for the colo-local "origin is down" flag; never a real page. */
const DOWN_FLAG_PATH = '/__rinkuzu/origin-down';
const DOWN_FLAG_TTL_MS = 30_000;
const ORIGIN_HEADERS_TIMEOUT_MS = 8_000;
const NOTIFY_API_TIMEOUT_MS = 8_000;
const EDGE_CLIENT_IP_HEADER = 'x-rinkuzu-client-ip';
const EDGE_SECRET_HEADER = 'x-rinkuzu-edge';

// Mirrors the API's own check (api/domains/outage_notify/schemas.py), so a typo
// is answered at the edge without spending the visitor's rate limit.
const EMAIL_PATTERN = /^[^@\s]{1,64}@[^@\s]+\.[^@\s.]{2,}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PATH_LENGTH = 512;
const MAX_UTM_LENGTH = 128;
const MAX_ENTRY_LENGTH = 64;

const OUTAGE_HEADERS = {
  'retry-after': '3600',
  'x-robots-tag': 'noindex',
  // At most 60 s, so the page clears quickly once the origin is back (spec AC 3).
  'cache-control': 'public, max-age=60',
} as const;

const NOTIFY_STATUS: Record<NotifyState, number> = {
  default: 200,
  success: 200,
  invalid: 422,
  rate_limited: 429,
  unavailable: 503,
};

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** A page load. API paths never count, whatever they accept: they never get HTML. */
function isNavigation(request: Request): boolean {
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    (request.headers.get('accept') ?? '').includes('text/html') &&
    !isApiPath(new URL(request.url).pathname)
  );
}

function hasLocalePrefix(pathname: string, locale: OutageLocale): boolean {
  return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`);
}

/** `vi` only when Vietnamese is the visitor's top preference. */
function prefersVietnamese(acceptLanguage: string | null): boolean {
  let best: { tag: string; quality: number } | null = null;
  for (const part of (acceptLanguage ?? '').split(',')) {
    const [rawTag = '', ...params] = part.trim().split(';');
    const tag = rawTag.trim().toLowerCase();
    if (!tag) continue;
    const qualityParam = params.map((param) => param.trim()).find((p) => p.startsWith('q='));
    const quality = qualityParam ? Number(qualityParam.slice(2)) : 1;
    if (!Number.isFinite(quality)) continue;
    if (!best || quality > best.quality) best = { tag, quality };
  }
  return best !== null && (best.tag === 'vi' || best.tag.startsWith('vi-'));
}

export function detectLocale(request: Request): OutageLocale {
  const { pathname } = new URL(request.url);
  if (hasLocalePrefix(pathname, 'vi')) return 'vi';
  if (hasLocalePrefix(pathname, 'en')) return 'en';
  return prefersVietnamese(request.headers.get('accept-language')) ? 'vi' : 'en';
}

function contextQuery(params: URLSearchParams): ContextQuery {
  const query: ContextQuery = {};
  for (const key of CONTEXT_QUERY_KEYS) {
    const value = params.get(key)?.trim();
    if (value) query[key] = value.slice(0, key === 'entry' ? MAX_ENTRY_LENGTH : MAX_UTM_LENGTH);
  }
  return query;
}

function safePath(value: string | null | undefined): string {
  const path = (value ?? '').trim();
  // Only a same-site path: no scheme, no protocol-relative `//host`.
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  return path.slice(0, MAX_PATH_LENGTH);
}

function htmlResponse(html: string, status: number, headers: Record<string, string>, head = false) {
  return new Response(head ? null : html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

function outageResponse(request: Request): Response {
  const url = new URL(request.url);
  if (isNavigation(request)) {
    const html = renderOutagePage({
      locale: detectLocale(request),
      path: safePath(url.pathname),
      query: contextQuery(url.searchParams),
      state: 'default',
    });
    return htmlResponse(html, 503, OUTAGE_HEADERS, request.method === 'HEAD');
  }
  if (isApiPath(url.pathname)) {
    const body = JSON.stringify({
      success: false,
      error: {
        code: 'service_unavailable',
        message: 'Rinkuzu is temporarily unavailable. Please try again later.',
      },
    });
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', ...OUTAGE_HEADERS },
    });
  }
  return new Response(request.method === 'HEAD' ? null : 'Rinkuzu is temporarily unavailable.\n', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...OUTAGE_HEADERS },
  });
}

/**
 * Failures that mean the whole deployment or origin is gone, so the colo may
 * skip the origin for 30 s: 402, Vercel's `DEPLOYMENT_*` errors at any status,
 * Cloudflare's origin errors 520–530, and a 502/504 from a gateway in front of
 * the app (no `x-vercel-error`). Function-level `x-vercel-error` codes
 * (`FUNCTION_INVOCATION_FAILED`, `FUNCTION_INVOCATION_TIMEOUT`, ...) and the
 * app's own 5xx are one broken route: they are handled per request and must
 * never flip the whole site to the outage page.
 */
function isOriginDown(response: Response): boolean {
  const { status } = response;
  const vercelError = response.headers.get('x-vercel-error');
  if (status === 402) return true;
  if (vercelError?.startsWith('DEPLOYMENT_')) return true;
  if (status >= 520 && status <= 530) return true;
  return (status === 502 || status === 504) && vercelError === null;
}

function downFlagKey(request: Request): Request {
  return new Request(new URL(DOWN_FLAG_PATH, request.url).toString());
}

async function originMarkedDown(
  request: Request,
  cache: ColoCache | null,
  now: number,
): Promise<boolean> {
  if (!cache) return false;
  const flag = await cache.match(downFlagKey(request));
  if (!flag) return false;
  // The cache also expires it by max-age; the timestamp keeps the 30 s exact.
  const markedAt = Number(await flag.text());
  return Number.isFinite(markedAt) && now - markedAt < DOWN_FLAG_TTL_MS;
}

function markOriginDown(
  request: Request,
  cache: ColoCache | null,
  now: number,
  context: WorkerContext,
): void {
  if (!cache) return;
  const flag = new Response(String(now), {
    headers: { 'cache-control': `max-age=${DOWN_FLAG_TTL_MS / 1000}` },
  });
  context.waitUntil(cache.put(downFlagKey(request), flag).catch(() => undefined));
}

function originRequest(request: Request, env: OutageEnvironment, signal?: AbortSignal): Request {
  const headers = new Headers(request.headers);
  const clientIp = request.headers.get('cf-connecting-ip');
  // Always overwrite: a visitor could send these headers themselves.
  if (clientIp) headers.set(EDGE_CLIENT_IP_HEADER, clientIp);
  else headers.delete(EDGE_CLIENT_IP_HEADER);
  const secret = env.EDGE_SHARED_SECRET?.trim();
  if (secret) headers.set(EDGE_SECRET_HEADER, secret);
  else headers.delete(EDGE_SECRET_HEADER);
  return new Request(request, {
    headers,
    redirect: 'manual',
    ...(signal ? { signal } : {}),
  });
}

/** Aborts the call when no response headers arrived in time; the timer stops once they do. */
async function fetchWithHeadersTimeout(
  fetcher: OutageDependencies['fetch'],
  build: (signal: AbortSignal) => Request,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('headers timeout')), timeoutMs);
  try {
    return await fetcher(build(controller.signal));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Only navigations get the 8 s headers timeout. The timer stops once headers
 * arrive, so it never cuts a streaming body (Ask Rin), and slow API calls (AI
 * generation, uploads) keep the origin's own limits.
 */
async function fetchOrigin(
  request: Request,
  env: OutageEnvironment,
  fetcher: OutageDependencies['fetch'],
): Promise<Response | null> {
  if (!isNavigation(request)) {
    try {
      return await fetcher(originRequest(request, env));
    } catch {
      return null;
    }
  }
  try {
    return await fetchWithHeadersTimeout(
      fetcher,
      (signal) => originRequest(request, env, signal),
      ORIGIN_HEADERS_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

async function proxy(
  request: Request,
  env: OutageEnvironment,
  context: WorkerContext,
  deps: OutageDependencies,
): Promise<Response> {
  const cache = deps.cache();
  if (await originMarkedDown(request, cache, deps.now())) return outageResponse(request);

  const response = await fetchOrigin(request, env, deps.fetch);
  if (response === null || isOriginDown(response)) {
    markOriginDown(request, cache, deps.now(), context);
    void response?.body?.cancel().catch(() => undefined);
    return outageResponse(request);
  }
  // An app- or function-level 5xx on a page is a broken page either way; show the outage
  // page there too, but leave API errors (their JSON envelope) to the app.
  if (response.status >= 500 && isNavigation(request)) {
    void response.body?.cancel().catch(() => undefined);
    return outageResponse(request);
  }
  return response;
}

function isSameHostPost(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null) return fetchSite === 'same-origin';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function formString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' ? value : undefined;
}

async function submitToApi(
  payload: Record<string, unknown>,
  clientIp: string | null,
  env: OutageEnvironment,
  fetcher: OutageDependencies['fetch'],
): Promise<NotifyState> {
  const token = env.OUTAGE_NOTIFY_TOKEN?.trim();
  if (!token) return 'unavailable';
  const headers = new Headers({
    'content-type': 'application/json',
    'x-outage-notify-token': token,
  });
  if (clientIp) headers.set('x-client-ip', clientIp);
  try {
    const response = await fetchWithHeadersTimeout(
      fetcher,
      (signal) =>
        new Request(env.NOTIFY_API_URL?.trim() || DEFAULT_NOTIFY_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          redirect: 'manual',
          signal,
        }),
      NOTIFY_API_TIMEOUT_MS,
    );
    void response.body?.cancel().catch(() => undefined);
    if (response.status >= 200 && response.status < 300) return 'success';
    if (response.status === 422) return 'invalid';
    if (response.status === 429) return 'rate_limited';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * The form posts here and the answer is the page itself, rendered in the
 * resulting state (no redirect), so the result also works without JavaScript.
 * The inline script asks for JSON instead.
 */
async function handleNotify(
  request: Request,
  env: OutageEnvironment,
  deps: OutageDependencies,
): Promise<Response> {
  const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  if (request.method !== 'POST') {
    return new Response('Method not allowed\n', {
      status: 405,
      headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8', ...noStore },
    });
  }
  if (!isSameHostPost(request)) {
    return new Response('Forbidden\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...noStore },
    });
  }

  const form = await request.formData().catch(() => new FormData());
  const formLocale = formString(form, 'locale');
  const locale: OutageLocale =
    formLocale === 'vi' || formLocale === 'en' ? formLocale : detectLocale(request);
  const path = safePath(formString(form, 'path'));
  const queryParams = new URLSearchParams();
  for (const key of CONTEXT_QUERY_KEYS) {
    const value = formString(form, key);
    if (value) queryParams.set(key, value);
  }
  const query = contextQuery(queryParams);
  const email = (formString(form, 'email') ?? '').trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);

  const state: NotifyState = EMAIL_PATTERN.test(email)
    ? await submitToApi(
        {
          email,
          locale,
          path,
          utm: {
            source: query.utm_source ?? null,
            medium: query.utm_medium ?? null,
            campaign: query.utm_campaign ?? null,
            content: query.utm_content ?? null,
            term: query.utm_term ?? null,
          },
          entry: query.entry ?? null,
          consent_text: consentText(locale),
          consent_version: CONSENT_VERSION,
        },
        request.headers.get('cf-connecting-ip'),
        env,
        deps.fetch,
      )
    : 'invalid';

  const status = NOTIFY_STATUS[state];
  if ((request.headers.get('accept') ?? '').includes('application/json')) {
    return new Response(JSON.stringify({ state }), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', ...noStore },
    });
  }
  const html = renderOutagePage({
    locale,
    path,
    query,
    state,
    ...(state === 'success' ? {} : { email }),
  });
  return htmlResponse(html, status, noStore);
}

async function handle(
  request: Request,
  env: OutageEnvironment,
  context: WorkerContext,
  deps: OutageDependencies,
): Promise<Response> {
  if (new URL(request.url).pathname === NOTIFY_PATH) return handleNotify(request, env, deps);
  return proxy(request, env, context, deps);
}

function isColoCache(value: unknown): value is ColoCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'match') === 'function' &&
    typeof Reflect.get(value, 'put') === 'function'
  );
}

/** `caches.default` in the Workers runtime; absent in Node and browsers. */
function runtimeColoCache(): ColoCache | null {
  const storage: unknown = Reflect.get(globalThis, 'caches');
  if (typeof storage !== 'object' || storage === null) return null;
  const colo: unknown = Reflect.get(storage, 'default');
  return isColoCache(colo) ? colo : null;
}

export function createOutageWorker(overrides: Partial<OutageDependencies> = {}) {
  const deps: OutageDependencies = {
    fetch: (request) => fetch(request),
    cache: runtimeColoCache,
    now: () => Date.now(),
    ...overrides,
  };
  return {
    async fetch(
      request: Request,
      env: OutageEnvironment,
      context: WorkerContext,
    ): Promise<Response> {
      try {
        return await handle(request, env, context, deps);
      } catch (error) {
        // Fail open: a bug here must never take the site down.
        console.error(
          JSON.stringify({
            event: 'outage_fallback_error',
            error: error instanceof Error ? error.message : 'unknown',
          }),
        );
        return deps.fetch(request);
      }
    },
  };
}

export default createOutageWorker();
