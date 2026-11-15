import { afterEach, describe, expect, it, vi } from 'vitest';

import { trustedEdgeClientIp } from '@/lib/client-ip';

const EDGE_CLIENT_IP_HEADER = 'x-rinkuzu-client-ip';
const EDGE_SECRET_HEADER = 'x-rinkuzu-edge';
const EDGE_SECRET = 'edge-shared-secret-fixture-0123456789abcdef';

function edgeHeaders(secret: string | null, ip = '203.0.113.42'): Headers {
  const headers = new Headers({
    [EDGE_CLIENT_IP_HEADER]: ip,
    'x-real-ip': '172.64.0.1',
    'x-forwarded-for': '172.64.0.1',
  });
  if (secret !== null) headers.set(EDGE_SECRET_HEADER, secret);
  return headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('trustedEdgeClientIp', () => {
  it('returns the edge client IP when the edge secret matches', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);

    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET))).toBe('203.0.113.42');
    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET, ' 2001:db8::1 '))).toBe('2001:db8::1');
  });

  it('ignores the edge client IP when the secret is wrong or missing', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);

    expect(trustedEdgeClientIp(edgeHeaders(null))).toBeNull();
    expect(trustedEdgeClientIp(edgeHeaders(''))).toBeNull();
    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET.slice(0, -1) + 'X'))).toBeNull();
  });

  it('compares secrets of a different length without throwing', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);

    expect(trustedEdgeClientIp(edgeHeaders('short'))).toBeNull();
    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET + '-and-more'))).toBeNull();
  });

  it('keeps the trusted path off when the secret is unset or too short', () => {
    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET))).toBeNull();

    vi.stubEnv('EDGE_SHARED_SECRET', '');
    expect(trustedEdgeClientIp(edgeHeaders(''))).toBeNull();

    vi.stubEnv('EDGE_SHARED_SECRET', 'too-short-secret');
    expect(trustedEdgeClientIp(edgeHeaders('too-short-secret'))).toBeNull();
  });

  it('rejects a value that is not an IP address even with a valid secret', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);

    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET, 'not-an-ip'))).toBeNull();
    expect(trustedEdgeClientIp(edgeHeaders(EDGE_SECRET, ''))).toBeNull();
  });
});

describe('resolveClientIp', () => {
  const VISITOR = '203.0.113.9';
  const FORGED = '10.9.9.9';

  it('behind cloudflared uses cf-connecting-ip and ignores a forged x-real-ip', async () => {
    const { resolveClientIp } = await import('@/lib/client-ip');
    const headers = new Headers({
      'cf-connecting-ip': VISITOR,
      'x-real-ip': FORGED,
      'x-forwarded-for': `${FORGED}, ${VISITOR}`,
    });
    expect(resolveClientIp(headers)).toBe(VISITOR);
  });

  it('trusts x-real-ip only when CLIENT_IP_HEADER=x-real-ip (Vercel)', async () => {
    const { resolveClientIp } = await import('@/lib/client-ip');
    const headers = new Headers({ 'x-real-ip': VISITOR, 'x-forwarded-for': FORGED });
    expect(resolveClientIp(headers)).toBe(FORGED);
    vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');
    expect(resolveClientIp(headers)).toBe(VISITOR);
  });

  it('prefers the edge-secret address, then falls back to the first x-forwarded-for hop', async () => {
    const { resolveClientIp } = await import('@/lib/client-ip');
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);
    expect(resolveClientIp(edgeHeaders(EDGE_SECRET))).toBe('203.0.113.42');
    vi.unstubAllEnvs();
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': ` ${VISITOR} , 70.41.3.18` }))).toBe(
      VISITOR,
    );
  });

  it('returns null with no valid address', async () => {
    const { resolveClientIp } = await import('@/lib/client-ip');
    expect(resolveClientIp(new Headers())).toBeNull();
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': 'garbage' }))).toBeNull();
  });
});

describe('ipBucketKey', () => {
  it('never shares a bucket between unattributed callers', async () => {
    const { ipBucketKey } = await import('@/lib/client-ip');
    expect(ipBucketKey('203.0.113.9')).toBe('203.0.113.9');
    expect(ipBucketKey(null)).not.toBe(ipBucketKey(null));
    expect(ipBucketKey(null)).not.toBe('unknown');
  });
});

describe('resolveClientCountry', () => {
  it('reads Vercel or Cloudflare and maps XX/T1/garbage to null', async () => {
    const { resolveClientCountry } = await import('@/lib/client-ip');
    expect(resolveClientCountry(new Headers({ 'x-vercel-ip-country': 'JP' }))).toBe('JP');
    expect(resolveClientCountry(new Headers({ 'cf-ipcountry': 'VN' }))).toBe('VN');
    expect(resolveClientCountry(new Headers({ 'cf-ipcountry': 'XX' }))).toBeNull();
    expect(resolveClientCountry(new Headers({ 'cf-ipcountry': 'T1' }))).toBeNull();
    expect(resolveClientCountry(new Headers({ 'cf-ipcountry': 'USA' }))).toBeNull();
    expect(resolveClientCountry(new Headers())).toBeNull();
  });
});
