import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/models/AuditLog', () => ({ default: { create: vi.fn() } }));

import { extractRequestContext } from '@/lib/audit';
import { hashReporterAddress } from '@/lib/quiz-report-rate-limit';

beforeEach(() => {
  vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');
});

const EDGE_CLIENT_IP_HEADER = 'x-rinkuzu-client-ip';
const EDGE_SECRET_HEADER = 'x-rinkuzu-edge';
const EDGE_SECRET = 'edge-shared-secret-fixture-0123456789abcdef';
const VISITOR = '203.0.113.42';
const CLOUDFLARE = '172.64.0.1';

function proxiedHeaders(edgeSecret: string | null): Headers {
  const headers = new Headers({
    [EDGE_CLIENT_IP_HEADER]: VISITOR,
    'x-real-ip': CLOUDFLARE,
    'x-forwarded-for': CLOUDFLARE,
  });
  if (edgeSecret !== null) headers.set(EDGE_SECRET_HEADER, edgeSecret);
  return headers;
}

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-auth-secret-at-least-32-characters');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('client IP readers behind the edge Worker', () => {
  it('use the edge client IP when the secret matches', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);
    const headers = proxiedHeaders(EDGE_SECRET);

    expect(extractRequestContext({ headers }).ip).toBe(VISITOR);
    expect(hashReporterAddress(headers)).toBe(
      hashReporterAddress(new Headers({ 'x-real-ip': VISITOR })),
    );
  });

  it('fall back to the platform headers when the secret is forged', () => {
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);
    const headers = proxiedHeaders('forged-secret-forged-secret-forged-secret');

    expect(extractRequestContext({ headers }).ip).toBe(CLOUDFLARE);
    expect(hashReporterAddress(headers)).toBe(
      hashReporterAddress(new Headers({ 'x-real-ip': CLOUDFLARE })),
    );
  });

  it('fall back to the platform headers when no secret is configured', () => {
    const headers = proxiedHeaders(EDGE_SECRET);

    expect(extractRequestContext({ headers }).ip).toBe(CLOUDFLARE);
    expect(hashReporterAddress(headers)).toBe(
      hashReporterAddress(new Headers({ 'x-real-ip': CLOUDFLARE })),
    );
  });
});
