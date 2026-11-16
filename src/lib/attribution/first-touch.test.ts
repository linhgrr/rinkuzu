import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFirstTouch,
  captureFirstTouch,
  encodeFirstTouch,
  FIRST_TOUCH_COOKIE,
  parseFirstTouch,
  type FirstTouch,
} from '@/lib/attribution/first-touch';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function fakeDocument(referrer = '', cookie = '') {
  const writes: string[] = [];
  const doc = {
    referrer,
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      writes.push(value);
      cookie = value.split(';')[0] ?? '';
    },
  };
  return { doc, writes };
}

const https = (path: string) => ({ href: `https://www.example.test${path}`, protocol: 'https:' });

describe('buildFirstTouch', () => {
  it('lowercases and truncates utm values, keeps the path without its query', () => {
    const long = 'A'.repeat(90);
    const touch = buildFirstTouch(
      new URL(`https://www.example.test/vi/blog/?utm_source=ThreadS&utm_campaign=${long}&x=1`),
      'https://www.google.com/',
      NOW,
    );
    expect(touch).toEqual({
      utm_source: 'threads',
      utm_campaign: 'a'.repeat(64),
      referrer_class: 'search',
      entry_path: '/vi/blog',
      first_seen_at: NOW.toISOString(),
    });
  });

  it('drops a utm value with disallowed characters', () => {
    const touch = buildFirstTouch(
      new URL('https://www.example.test/?utm_source=a%20b%3Cscript%3E'),
      '',
      NOW,
    );
    expect(touch.utm_source).toBeUndefined();
    expect(touch.referrer_class).toBe('direct');
  });
});

describe('captureFirstTouch', () => {
  it('writes the cookie with consent never consulted', () => {
    const { doc, writes } = fakeDocument();
    expect(captureFirstTouch(doc, https('/en?utm_source=fb'), NOW)).toBe(true);
    expect(writes[0]).toContain(`${FIRST_TOUCH_COOKIE}=`);
    expect(writes[0]).toContain('Max-Age=604800');
    expect(writes[0]).toContain('SameSite=Lax');
    expect(writes[0]).toContain('Secure');
    expect(writes[0]?.length).toBeLessThan(1024);
  });

  it('keeps the first touch over a second utm visit within 7 days', () => {
    const { doc, writes } = fakeDocument();
    captureFirstTouch(doc, https('/en?utm_source=first'), NOW);
    const later = new Date(NOW.getTime() + 3 * DAY);
    expect(captureFirstTouch(doc, https('/en?utm_source=second'), later)).toBe(false);
    expect(writes).toHaveLength(1);
  });

  it('replaces a record that is 7 days old', () => {
    const { doc, writes } = fakeDocument();
    captureFirstTouch(doc, https('/en?utm_source=first'), NOW);
    const later = new Date(NOW.getTime() + 7 * DAY);
    expect(captureFirstTouch(doc, https('/en?utm_source=second'), later)).toBe(true);
    expect(writes).toHaveLength(2);
  });

  it('never lets an internal visit replace an existing record', () => {
    const { doc } = fakeDocument('https://www.example.test/en');
    captureFirstTouch(doc, https('/en?utm_source=first'), NOW);
    const later = new Date(NOW.getTime() + 9 * DAY);
    expect(captureFirstTouch(doc, https('/vi'), later)).toBe(false);
  });

  it('omits Secure on http', () => {
    const { doc, writes } = fakeDocument();
    captureFirstTouch(doc, { href: 'http://localhost:3000/en', protocol: 'http:' }, NOW);
    expect(writes[0]).not.toContain('Secure');
  });
});

describe('parseFirstTouch', () => {
  const valid: FirstTouch = {
    utm_source: 'threads',
    referrer_class: 'social',
    entry_path: '/vi/blog',
    first_seen_at: NOW.toISOString(),
  };
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

  it('round-trips what the browser writes', () => {
    expect(parseFirstTouch(encodeFirstTouch(valid), NOW)).toEqual(valid);
  });

  it('ignores missing, oversized, non-base64 and non-object values', () => {
    expect(parseFirstTouch(undefined, NOW)).toBeNull();
    expect(parseFirstTouch('', NOW)).toBeNull();
    expect(parseFirstTouch('a'.repeat(1025), NOW)).toBeNull();
    expect(parseFirstTouch('%%%not-json', NOW)).toBeNull();
    expect(parseFirstTouch(enc([1]), NOW)).toBeNull();
    expect(parseFirstTouch(enc('x'), NOW)).toBeNull();
  });

  it('rejects a bad class, path or timestamp', () => {
    expect(parseFirstTouch(enc({ ...valid, referrer_class: 'ads' }), NOW)).toBeNull();
    expect(parseFirstTouch(enc({ ...valid, entry_path: '/a?b=1' }), NOW)).toBeNull();
    expect(parseFirstTouch(enc({ ...valid, entry_path: 'evil' }), NOW)).toBeNull();
    expect(parseFirstTouch(enc({ ...valid, entry_path: `/${'a'.repeat(250)}` }), NOW)).toBeNull();
    expect(parseFirstTouch(enc({ ...valid, first_seen_at: 'yesterday' }), NOW)).toBeNull();
    expect(
      parseFirstTouch(enc({ ...valid, first_seen_at: new Date(NOW.getTime() + 5 * DAY) }), NOW),
    ).toBeNull();
  });

  it('drops an invalid utm field but keeps the rest', () => {
    const parsed = parseFirstTouch(
      enc({ ...valid, utm_medium: 'UPPER', utm_campaign: 'x'.repeat(65), utm_content: 7 }),
      NOW,
    );
    expect(parsed).toEqual(valid);
  });
});

describe('first touch without Node Buffer and with odd paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the cookie when Buffer is missing (browser bundle)', () => {
    const touch: FirstTouch = {
      utm_source: 'threads',
      referrer_class: 'social',
      entry_path: '/vi/blog',
      first_seen_at: NOW.toISOString(),
    };
    const raw = encodeFirstTouch(touch);
    vi.stubGlobal('Buffer', undefined);
    expect(parseFirstTouch(raw, NOW)).toEqual(touch);
  });

  it('round-trips a pathname with characters the parser would reject', () => {
    for (const pathname of [
      '/a+b',
      '/x:y@z,w',
      '/vi/blog/a;b=c',
      '/%E1%BB%87/ok',
      '/' + 'a'.repeat(300),
    ]) {
      const built = buildFirstTouch(new URL(`https://www.rinkuzu.app${pathname}`), '', NOW);
      expect(parseFirstTouch(encodeFirstTouch(built), NOW)).toEqual(built);
    }
  });
});
