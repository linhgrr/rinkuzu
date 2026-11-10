import { describe, expect, it, vi } from 'vitest';

import { createGuestDraftLimiter, resolveGuestDraftLimits } from '@/lib/guest-draft/limits';
import type { RateLimiterRegistry, RateLimitOutcome } from '@/lib/rate-limit-core';

type Action = 'guest_draft_ip' | 'guest_draft_daily';

const allowed: RateLimitOutcome = { allowed: true, remaining: 1, resetSeconds: 60, limit: 2 };
const denied: RateLimitOutcome = { allowed: false, retryAfterSeconds: 120, limit: 2 };

function fakeRegistry(outcomes: Partial<Record<Action, RateLimitOutcome>> = {}) {
  return {
    resolveLimit: vi.fn(() => ({ points: 2, durationSec: 86_400 })),
    consume: vi.fn(async (action: Action) => outcomes[action] ?? allowed),
    refund: vi.fn(async () => undefined),
  } satisfies RateLimiterRegistry<Action>;
}

const now = () => new Date('2026-11-10T23:59:00.000Z');

describe('resolveGuestDraftLimits', () => {
  it('defaults to 2 per IP and 30 per UTC day', () => {
    expect(resolveGuestDraftLimits({})).toEqual({ ipPerDay: 2, globalPerUtcDay: 30 });
  });

  it('reads GUEST_DRAFT_IP_LIMIT and GUEST_DRAFT_DAILY_LIMIT', () => {
    expect(
      resolveGuestDraftLimits({ GUEST_DRAFT_IP_LIMIT: '5', GUEST_DRAFT_DAILY_LIMIT: '100' }),
    ).toEqual({ ipPerDay: 5, globalPerUtcDay: 100 });
  });

  it('ignores a non-positive or garbage override', () => {
    expect(
      resolveGuestDraftLimits({ GUEST_DRAFT_IP_LIMIT: '0', GUEST_DRAFT_DAILY_LIMIT: 'lots' }),
    ).toEqual({ ipPerDay: 2, globalPerUtcDay: 30 });
  });
});

describe('createGuestDraftLimiter', () => {
  it('consumes the IP slot, then the UTC-day slot', async () => {
    const registry = fakeRegistry();
    const limiter = createGuestDraftLimiter(registry, now);

    expect(await limiter.reserve('203.0.113.7')).toEqual({ ok: true });
    expect(registry.consume.mock.calls).toEqual([
      ['guest_draft_ip', '203.0.113.7'],
      ['guest_draft_daily', 'utc:2026-11-10'],
    ]);
  });

  it('per-IP cap hit: refused without touching the global cap', async () => {
    const registry = fakeRegistry({ guest_draft_ip: denied });
    const limiter = createGuestDraftLimiter(registry, now);

    expect(await limiter.reserve('203.0.113.7')).toEqual({
      ok: false,
      scope: 'ip',
      retryAfterSeconds: 120,
    });
    expect(registry.consume).toHaveBeenCalledOnce();
  });

  it('global cap hit: refused and the IP slot goes back', async () => {
    const registry = fakeRegistry({ guest_draft_daily: denied });
    const limiter = createGuestDraftLimiter(registry, now);

    expect(await limiter.reserve('203.0.113.7')).toEqual({
      ok: false,
      scope: 'daily',
      retryAfterSeconds: 120,
    });
    expect(registry.refund).toHaveBeenCalledWith('guest_draft_ip', '203.0.113.7');
  });

  it('refunds go to the same keys', async () => {
    const registry = fakeRegistry();
    const limiter = createGuestDraftLimiter(registry, now);

    await limiter.refundIp(null);
    await limiter.refundDaily();

    expect(registry.refund.mock.calls).toEqual([
      ['guest_draft_ip', 'unknown'],
      ['guest_draft_daily', 'utc:2026-11-10'],
    ]);
  });
});
