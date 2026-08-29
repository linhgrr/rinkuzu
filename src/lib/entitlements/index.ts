/**
 * Central entitlements registry — single source of truth for what each tier
 * can do. Feature code asks "can this user do X" (capability), never "what tier
 * is this user" (plan name). Plans/tiers never leak into feature logic.
 *
 * Two capability kinds:
 *  - boolean: yes/no feature gates
 *  - metered: calendar-aware quotas for variable-cost actions
 *
 * B2C, per-user, 2 tiers — a code registry is enough (no DB entitlements table,
 * no org overrides, no RBAC). Add those only when trials/enterprise arrive.
 */
import { createEntitlementService } from '@/lib/entitlement-factory';
import { logger } from '@/lib/logger';
import type {
  BooleanCapability,
  EntitlementConstraint,
  Entitlements,
  MeteredCapability,
  RateWindow,
  Tier,
} from '@/types/entitlements';

export type {
  BooleanCapability,
  Entitlements,
  MeteredCapability,
  RateWindow,
  Tier,
} from '@/types/entitlements';

type MeteredLimit = {
  enabled: boolean;
  limits: Partial<Record<RateWindow, number>>;
};

interface TierEntitlements {
  boolean: Record<BooleanCapability, boolean>;
  metered: Record<MeteredCapability, MeteredLimit>;
  constraints: Record<EntitlementConstraint, number>;
}

const ENTITLEMENT_REGISTRY: Record<Tier, TierEntitlements> = {
  free: {
    boolean: { premium_catalog: false },
    constraints: {
      quiz_pdf_pages: 30,
      adaptive_pdf_pages: 30,
      pdf_upload_bytes: 100 * 1024 * 1024,
    },
    metered: {
      ask_rin_chan: { enabled: true, limits: { minute: 5, day: 25 } },
      quiz_extract: { enabled: true, limits: { minute: 1, month: 5 } },
      adaptive_pipeline: { enabled: true, limits: { minute: 1, month: 2 } },
      adaptive_generation: { enabled: true, limits: { minute: 6, day: 50 } },
    },
  },
  premium: {
    boolean: { premium_catalog: true },
    constraints: {
      quiz_pdf_pages: 100,
      adaptive_pdf_pages: 100,
      pdf_upload_bytes: 100 * 1024 * 1024,
    },
    metered: {
      ask_rin_chan: { enabled: true, limits: { minute: 15, day: 150 } },
      quiz_extract: { enabled: true, limits: { minute: 2, month: 50 } },
      adaptive_pipeline: { enabled: true, limits: { minute: 1, month: 12 } },
      adaptive_generation: { enabled: true, limits: { minute: 20, day: 500 } },
    },
  },
};

export function can(entitlements: Entitlements, capability: BooleanCapability): boolean {
  return ENTITLEMENT_REGISTRY[entitlements.tier].boolean[capability];
}

export function getConstraint(
  entitlements: Entitlements,
  constraint: EntitlementConstraint,
): number {
  return ENTITLEMENT_REGISTRY[entitlements.tier].constraints[constraint];
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

function getLimit(
  entitlements: Entitlements,
  action: MeteredCapability,
  window: RateWindow,
): number | undefined {
  const configured = ENTITLEMENT_REGISTRY[entitlements.tier].metered[action];
  if (!configured.enabled || configured.limits[window] === undefined) return undefined;
  return readLimitEnv(action, entitlements.tier, window) ?? configured.limits[window];
}

export function getMeteredWindows(
  entitlements: Entitlements,
  action: MeteredCapability,
): Array<{ window: RateWindow; limit: number }> {
  const windows: RateWindow[] = ['minute', 'day', 'month'];
  return windows.flatMap((window) => {
    const limit = getLimit(entitlements, action, window);
    return limit === undefined ? [] : [{ window, limit }];
  });
}

export function isMeteredCapabilityEnabled(
  entitlements: Entitlements,
  action: MeteredCapability,
): boolean {
  return ENTITLEMENT_REGISTRY[entitlements.tier].metered[action].enabled;
}

/**
 * Resolve a user's entitlements from the entitlement projection on every call.
 *
 * There is deliberately no cache. A process-local one is incoherent on
 * serverless — each instance holds its own copy, so an entitlement granted on
 * one instance is invisible to the others until their entry expires, and a
 * lookup failure cached as `free` keeps a paying user locked out for the whole
 * TTL. The read is a single indexed projection lookup.
 *
 * Fail-closed: any error resolving premium status falls back to `free`, so a
 * lookup failure never hands out paid access. The failure is logged rather than
 * swallowed, because a silent fallback and a genuinely free user look identical
 * from the outside.
 */
export async function resolveEntitlements(userId: string): Promise<Entitlements> {
  try {
    const isPremium = await createEntitlementService().isUserPremium(userId);
    return { tier: isPremium ? 'premium' : 'free' };
  } catch (error) {
    logger.warn({ err: error, userId }, 'Entitlement resolution failed; falling back to free');
    return { tier: 'free' };
  }
}
