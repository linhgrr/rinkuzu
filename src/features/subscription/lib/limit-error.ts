const UPGRADE_ELIGIBLE_CODES = new Set(['llm_rate_limit_exceeded', 'premium_required']);

type ErrorWithEntitlement = {
  code?: unknown;
  meta?: unknown;
  payload?: unknown;
};

function hasUpgradeEligibleMeta(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const meta = value as { upgradeEligible?: unknown };
  return meta.upgradeEligible === true;
}

/**
 * Identifies errors that represent a product entitlement boundary.
 * Transport/status alone is intentionally insufficient: unrelated 429s (for
 * example auth abuse protection) must not open an upgrade prompt.
 */
export function isPremiumLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as ErrorWithEntitlement;
  if (typeof candidate.code === 'string' && UPGRADE_ELIGIBLE_CODES.has(candidate.code)) {
    return true;
  }
  return hasUpgradeEligibleMeta(candidate.meta) || hasUpgradeEligibleMeta(candidate.payload);
}
