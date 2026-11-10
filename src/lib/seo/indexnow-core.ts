/**
 * IndexNow (RIN-1496, RIN-1500): tells Bing (and through it ChatGPT and
 * Copilot search) that public pages changed. The key is a public verification
 * value, not a secret: it is served at `/<key>.txt` from `public/`.
 *
 * This module imports nothing, so the post-deploy ping
 * (`scripts/indexnow-deploy.mjs`, RIN-1501) loads it with Node's type
 * stripping and sends exactly what the app sends. The app's entry point is
 * `@/lib/seo/indexnow`, which adds the production switch and the logger.
 */
/** @public The key-file test and the post-deploy ping (RIN-1501) read it. */
export const INDEXNOW_KEY = '1427ba4d-007f-4e24-84c6-a820a80d51b0';
const INDEXNOW_HOST = 'www.rinkuzu.app';
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** IndexNow accepts at most 10 000 URLs per request. */
export const INDEXNOW_MAX_URLS_PER_CALL = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;

/**
 * Keeps absolute `https://www.rinkuzu.app/...` URLs without a query string or
 * fragment, deduplicated, in first-seen order.
 */
export function normalizeIndexNowUrls(urls: readonly string[]): string[] {
  const kept = new Set<string>();
  for (const raw of urls) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.host !== INDEXNOW_HOST) continue;
    if (raw.includes('?') || raw.includes('#')) continue;
    kept.add(url.toString());
  }
  return [...kept];
}

type IndexNowOutcome = 'sent' | 'rejected' | 'failed' | 'skipped';

export interface IndexNowResult {
  outcome: IndexNowOutcome;
  /** The last HTTP status, or null when no response arrived. */
  status: number | null;
  attempt: number;
  urlCount: number;
}

/** The one log line per call: counts and status, never URLs or ids. */
export interface IndexNowLogLine {
  event: 'indexnow';
  urlCount: number;
  status: number | null;
  attempt: number;
}

interface IndexNowPostDeps {
  fetch: typeof fetch;
  enabled: boolean;
  log: (line: IndexNowLogLine) => void;
}

function isRetryable(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}

/**
 * POSTs the URLs to IndexNow. A 5 s timeout, one retry on a network error, a
 * 429 or a 5xx, one log line per call (counts and status only), and never
 * throws. `sent` means 200/202; `rejected` is another 4xx, which a retry
 * would not change.
 */
export async function postIndexNow(
  urls: readonly string[],
  deps: IndexNowPostDeps,
): Promise<IndexNowResult> {
  const urlList = normalizeIndexNowUrls(urls).slice(0, INDEXNOW_MAX_URLS_PER_CALL);
  const urlCount = urlList.length;
  if (urlCount === 0 || !deps.enabled) {
    return { outcome: 'skipped', status: null, attempt: 0, urlCount };
  }

  const body = JSON.stringify({
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  });

  let status: number | null = null;
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    status = null;
    try {
      const response = await deps.fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      status = response.status;
    } catch {
      status = null;
    }
    if (!isRetryable(status)) break;
  }

  try {
    deps.log({ event: 'indexnow', urlCount, status, attempt });
  } catch {
    // Logging must never fail the caller.
  }

  if (status !== null && status >= 200 && status < 300) {
    return { outcome: 'sent', status, attempt, urlCount };
  }
  return { outcome: isRetryable(status) ? 'failed' : 'rejected', status, attempt, urlCount };
}
