import 'server-only';

import {
  createRateLimiterRegistry,
  type RateLimitOutcome,
  type RateLimitWindow,
} from '@/lib/rate-limit-core';

/**
 * Per-admin ceilings for admin reads that scan user data. Stored in
 * `auth_rate_limits` under its own `admin:` key prefix so it reuses that
 * collection's deployed TTL/key indexes instead of needing new production DDL.
 */
type AdminRateLimitAction = 'learner_search_user';

const DEFAULTS: Record<AdminRateLimitAction, RateLimitWindow> = {
  // Each search is an unindexed regex scan over users: typing pace, not a crawl.
  learner_search_user: { points: 30, durationSec: 60 },
};

const registry = createRateLimiterRegistry<AdminRateLimitAction>(
  { collection: 'auth_rate_limits', keyPrefix: 'admin:', envPrefix: 'ADMIN_RATE' },
  DEFAULTS,
);

export function consumeAdminRateLimit(
  action: AdminRateLimitAction,
  key: string,
): Promise<RateLimitOutcome> {
  return registry.consume(action, key);
}
