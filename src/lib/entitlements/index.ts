/**
 * Central entitlements registry — single source of truth for what each tier
 * can do. Feature code asks "can this user do X" (capability), never "what tier
 * is this user" (plan name). Plans/tiers never leak into feature logic.
 *
 * Two capability kinds:
 *  - boolean: yes/no feature gates (private_quiz, advanced_stats)
 *  - metered: per-minute/per-day quotas for LLM actions
 *
 * B2C, per-user, 2 tiers — a code registry is enough (no DB entitlements table,
 * no org overrides, no RBAC). Add those only when trials/enterprise arrive.
 */
import { createSubscriptionService } from '@/lib/subscription-factory';
import { getCachedTier, setCachedTier } from './cache';

export type Tier = 'free' | 'premium';

export type BooleanCapability = 'private_quiz' | 'advanced_stats';

export type MeteredCapability =
  | 'quiz_ask_ai'
  | 'quiz_extract'
  | 'adaptive_pipeline'
  | 'adaptive_tutor_chat'
  | 'adaptive_generation';

export type RateWindow = 'minute' | 'day';

type MeteredLimit = Record<RateWindow, number>;

interface TierEntitlements {
  boolean: Record<BooleanCapability, boolean>;
  metered: Record<MeteredCapability, MeteredLimit>;
}

const REGISTRY: Record<Tier, TierEntitlements> = {
  free: {
    boolean: { private_quiz: false, advanced_stats: false },
    metered: {
      quiz_ask_ai: { minute: 5, day: 20 },
      quiz_extract: { minute: 1, day: 3 },
      adaptive_pipeline: { minute: 1, day: 2 },
      adaptive_tutor_chat: { minute: 6, day: 30 },
      adaptive_generation: { minute: 6, day: 50 },
    },
  },
  premium: {
    boolean: { private_quiz: true, advanced_stats: true },
    metered: {
      quiz_ask_ai: { minute: 20, day: 200 },
      quiz_extract: { minute: 5, day: 30 },
      adaptive_pipeline: { minute: 3, day: 20 },
      adaptive_tutor_chat: { minute: 20, day: 300 },
      adaptive_generation: { minute: 20, day: 500 },
    },
  },
};

export interface Entitlements {
  tier: Tier;
}

export function can(entitlements: Entitlements, capability: BooleanCapability): boolean {
  return REGISTRY[entitlements.tier].boolean[capability];
}

function readLimitEnv(
  action: MeteredCapability,
  tier: Tier,
  window: RateWindow,
): number | undefined {
  const key = `LLM_RATE_${action}_${tier}_${window}`.toUpperCase();
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}

export function getLimit(
  entitlements: Entitlements,
  action: MeteredCapability,
  window: RateWindow,
): number {
  return (
    readLimitEnv(action, entitlements.tier, window) ??
    REGISTRY[entitlements.tier].metered[action][window]
  );
}

/**
 * Resolve a user's entitlements. Fail-closed: any error resolving premium
 * status falls back to `free` so a lookup failure never hands out paid access.
 *
 * Short-lived per-user tier cache (see ./cache) avoids a DB read on every gated
 * request; invalidated explicitly on subscription verify/activate/cancel.
 */
export async function resolveEntitlements(userId: string): Promise<Entitlements> {
  const now = Date.now();
  const cachedTier = getCachedTier(userId, now);
  if (cachedTier) {
    return { tier: cachedTier };
  }

  let tier: Tier = 'free';
  try {
    const isPremium = await createSubscriptionService().isUserPremium(userId);
    tier = isPremium ? 'premium' : 'free';
  } catch {
    tier = 'free';
  }

  setCachedTier(userId, tier, now);
  return { tier };
}
