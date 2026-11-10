import 'server-only';

import {
  createRateLimiterRegistry,
  type RateLimiterRegistry,
  type RateLimitWindow,
} from '@/lib/rate-limit-core';
import type {
  GuestDraftLimiter,
  GuestDraftReservation,
} from '@/interfaces/services/IGuestDraftService';

type GuestDraftLimitAction = 'guest_draft_ip' | 'guest_draft_daily';

const DAY_SECONDS = 24 * 60 * 60;

export interface GuestDraftLimits {
  ipPerDay: number;
  globalPerUtcDay: number;
}

function positiveInt(raw: string | undefined): number | null {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/** Spec AC3: 2 guest drafts per IP per 24 h and 30 per UTC day, both env-configurable. */
export function resolveGuestDraftLimits(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GuestDraftLimits {
  return {
    ipPerDay: positiveInt(env['GUEST_DRAFT_IP_LIMIT']) ?? 2,
    globalPerUtcDay: positiveInt(env['GUEST_DRAFT_DAILY_LIMIT']) ?? 30,
  };
}

/** One bucket per UTC date, kept two days so it never resets inside its day. */
function utcDayKey(now: Date): string {
  return `utc:${now.toISOString().slice(0, 10)}`;
}

function createRegistry(limits: GuestDraftLimits): RateLimiterRegistry<GuestDraftLimitAction> {
  const defaults: Record<GuestDraftLimitAction, RateLimitWindow> = {
    guest_draft_ip: { points: limits.ipPerDay, durationSec: DAY_SECONDS },
    guest_draft_daily: { points: limits.globalPerUtcDay, durationSec: 2 * DAY_SECONDS },
  };
  // The auth limiter's collection: its key and TTL indexes are already in the index
  // contract, and an IP lives only there, under the window's TTL.
  return createRateLimiterRegistry(
    { collection: 'auth_rate_limits', keyPrefix: 'guest:', envPrefix: 'GUEST_DRAFT_RATE' },
    defaults,
  );
}

/**
 * Both caps are checked before any upstream call. The IP is consumed first; when the
 * global cap then refuses, the IP slot goes back, because nothing was spent.
 */
export function createGuestDraftLimiter(
  registry: RateLimiterRegistry<GuestDraftLimitAction> = createRegistry(resolveGuestDraftLimits()),
  now: () => Date = () => new Date(),
): GuestDraftLimiter {
  const ipKey = (ip: string | null) => ip ?? 'unknown';
  return {
    async reserve(ip): Promise<GuestDraftReservation> {
      const perIp = await registry.consume('guest_draft_ip', ipKey(ip));
      if (!perIp.allowed) {
        return { ok: false, scope: 'ip', retryAfterSeconds: perIp.retryAfterSeconds };
      }
      const daily = await registry.consume('guest_draft_daily', utcDayKey(now()));
      if (!daily.allowed) {
        await registry.refund('guest_draft_ip', ipKey(ip));
        return { ok: false, scope: 'daily', retryAfterSeconds: daily.retryAfterSeconds };
      }
      return { ok: true };
    },
    refundIp: (ip) => registry.refund('guest_draft_ip', ipKey(ip)),
    refundDaily: () => registry.refund('guest_draft_daily', utcDayKey(now())),
  };
}
