/**
 * Standalone tier cache — no env/service imports so tests can reset it without
 * evaluating the env config chain. See entitlements/index.ts for usage.
 */
import type { Tier } from './index';

const TIER_TTL_MS = 60_000;
const tierCache = new Map<string, { tier: Tier; expiresAt: number }>();

export function getCachedTier(userId: string, now: number): Tier | undefined {
  const cached = tierCache.get(userId);
  return cached && cached.expiresAt > now ? cached.tier : undefined;
}

export function setCachedTier(userId: string, tier: Tier, now: number): void {
  tierCache.set(userId, { tier, expiresAt: now + TIER_TTL_MS });
}

export function invalidateEntitlements(userId: string): void {
  tierCache.delete(userId);
}

// Test-only: drop every cached tier so per-test premium mocks don't leak across
// cases via the module-level cache.
export function resetEntitlementsCache(): void {
  tierCache.clear();
}
