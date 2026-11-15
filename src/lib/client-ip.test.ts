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
