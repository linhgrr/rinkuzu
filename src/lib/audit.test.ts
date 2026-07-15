import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/models/AuditLog', () => ({ default: { create: vi.fn() } }));

import { extractRequestContext } from '@/lib/audit';

describe('extractRequestContext', () => {
  it('uses the first forwarded IP after trimming', () => {
    const headers = new Headers({
      'x-forwarded-for': ' 203.0.113.10, 198.51.100.2 ',
      'user-agent': 'audit-test',
    });

    expect(extractRequestContext({ headers })).toEqual({
      ip: '203.0.113.10',
      userAgent: 'audit-test',
    });
  });

  it('returns null for an empty forwarded IP entry', () => {
    const headers = new Headers({ 'x-forwarded-for': ',' });

    expect(extractRequestContext({ headers })).toEqual({ ip: null, userAgent: null });
  });
});
