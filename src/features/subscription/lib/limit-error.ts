/**
 * Detect "hit a premium/free-plan limit" errors across the app's error shapes
 * (ApiResponseError, AdaptiveApiError, or anything carrying a `code`/`status`).
 * Used to trigger the shared upgrade prompt from any feature.
 */
const LIMIT_CODES = new Set(['llm_rate_limit_exceeded', 'rate_limit_exceeded', 'premium_required']);

export function isPremiumLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown };
  if (typeof candidate.code === 'string' && LIMIT_CODES.has(candidate.code)) {
    return true;
  }
  return candidate.status === 429;
}
