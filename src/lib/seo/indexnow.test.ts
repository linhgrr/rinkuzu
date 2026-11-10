import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  INDEXNOW_KEY,
  isIndexNowEnabled,
  normalizeIndexNowUrls,
  submitIndexNow,
} from '@/lib/seo/indexnow';

const QUIZ_URL = 'https://www.rinkuzu.app/vi/quiz/fake-biology-quiz';
const HUB_URL = 'https://www.rinkuzu.app/vi/explore/fake-topic';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY_LOCATION = `https://www.rinkuzu.app/${INDEXNOW_KEY}.txt`;

function response(status: number): Response {
  return new Response(null, { status });
}

describe('IndexNow key file', () => {
  it('serves the key as the body of public/<key>.txt', () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    const body = readFileSync(path.join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`), 'utf8');
    expect(body.trim()).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://www.rinkuzu.app/${INDEXNOW_KEY}.txt`);
  });
});

describe('isIndexNowEnabled', () => {
  it.each([['preview'], ['development'], [undefined], ['staging']])(
    'is off for VERCEL_ENV=%s',
    (vercelEnv) => {
      expect(isIndexNowEnabled(vercelEnv)).toBe(false);
    },
  );

  it('is on for VERCEL_ENV=production', () => {
    expect(isIndexNowEnabled('production')).toBe(true);
  });
});

describe('normalizeIndexNowUrls', () => {
  it('keeps absolute production URLs once, drops queries, fragments and other hosts', () => {
    expect(
      normalizeIndexNowUrls([
        QUIZ_URL,
        QUIZ_URL,
        `${QUIZ_URL}?entry=hub`,
        `${HUB_URL}#top`,
        'http://www.rinkuzu.app/vi/quiz/x',
        'https://preview.example.test/vi/quiz/x',
        '/vi/quiz/relative',
        'not a url',
        HUB_URL,
      ]),
    ).toEqual([QUIZ_URL, HUB_URL]);
  });
});

describe('submitIndexNow', () => {
  it('does not call outside production', async () => {
    const fetchMock = vi.fn(async () => response(200));
    const result = await submitIndexNow([QUIZ_URL], { fetch: fetchMock, enabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.outcome).toBe('skipped');
  });

  it('posts host, key, keyLocation and the deduplicated list, and logs counts only', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => response(202));
    const log = vi.fn();
    const result = await submitIndexNow([QUIZ_URL, QUIZ_URL, HUB_URL, `${HUB_URL}?a=1`], {
      fetch: fetchMock,
      enabled: true,
      log,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      host: 'www.rinkuzu.app',
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: [QUIZ_URL, HUB_URL],
    });
    expect(result).toEqual({ outcome: 'sent', status: 202, attempt: 1, urlCount: 2 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ event: 'indexnow', urlCount: 2, status: 202, attempt: 1 });
  });

  it('retries once after a timeout and logs without throwing', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    const log = vi.fn();
    const result = await submitIndexNow([QUIZ_URL], {
      fetch: fetchMock,
      enabled: true,
      log,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ outcome: 'failed', status: null, attempt: 2, urlCount: 1 });
    expect(log).toHaveBeenCalledWith({ event: 'indexnow', urlCount: 1, status: null, attempt: 2 });
  });

  it.each([[429], [500], [503]])('retries once on %i', async (status) => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(response(status))
      .mockResolvedValueOnce(response(200));
    const result = await submitIndexNow([QUIZ_URL], {
      fetch: fetchMock,
      enabled: true,
      log: vi.fn(),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ outcome: 'sent', status: 200, attempt: 2, urlCount: 1 });
  });

  it('does not retry another 4xx', async () => {
    const fetchMock = vi.fn(async () => response(403));
    const result = await submitIndexNow([QUIZ_URL], {
      fetch: fetchMock,
      enabled: true,
      log: vi.fn(),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('rejected');
  });

  it('never throws when the logger throws', async () => {
    const result = await submitIndexNow([QUIZ_URL], {
      fetch: vi.fn(async () => response(200)),
      enabled: true,
      log: () => {
        throw new Error('log sink down');
      },
    });
    expect(result.outcome).toBe('sent');
  });
});
