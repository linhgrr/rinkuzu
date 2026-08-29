/**
 * What we are allowed to remember about an inbound webhook, and for how long.
 *
 * A webhook endpoint is an unauthenticated door: anyone can post anything to
 * it. Retaining raw bodies indiscriminately turns that door into a store of
 * attacker-controlled — and occasionally payer-identifying — text, while
 * retaining nothing leaves an operator with no way to explain a rejection.
 *
 * The compromise is retention by verification class. Only a body that carried a
 * valid provider signature is worth keeping at all, and even then only when we
 * could not understand it; everything else is reduced to a hash, a size and a
 * reason, which is enough to correlate and to count without storing the text.
 */

export const WEBHOOK_VERIFICATION_CLASSES = [
  /** Signature valid, schema understood, payment event. */
  'accepted',
  /** Signature valid, schema understood, not a successful payment. */
  'ignored',
  /** Signature valid, schema not understood. */
  'unsupported_schema',
  /** Signature absent, invalid, or unverifiable. */
  'unauthenticated',
] as const;
export type WebhookVerificationClass = (typeof WEBHOOK_VERIFICATION_CLASSES)[number];

export const WEBHOOK_REJECTION_REASONS = [
  'payload_too_large',
  'malformed_json',
  'invalid_envelope',
  'invalid_signature',
  'provider_not_configured',
] as const;
export type WebhookRejectionReason = (typeof WEBHOOK_REJECTION_REASONS)[number];

/** Whether the raw body may be persisted, and in what form. */
type RawBodyRetention = 'never' | 'encrypted';

export interface WebhookRetentionPolicy {
  readonly retainRawBody: RawBodyRetention;
  /** Days to keep the diagnostic row, or null to keep it as a business record. */
  readonly retentionDays: number | null;
}

/** Diagnostics for traffic we could not authenticate age out quickly. */
const UNAUTHENTICATED_RETENTION_DAYS = 30;
/** Authenticated events we deliberately do nothing with. */
const IGNORED_RETENTION_DAYS = 90;
/** The floor and ceiling an operator may configure for unreadable payloads. */
const UNSUPPORTED_RETENTION_DAYS_MIN = 1;
const UNSUPPORTED_RETENTION_DAYS_MAX = 90;
export const UNSUPPORTED_RETENTION_DAYS_DEFAULT = 30;

export function clampUnsupportedRetentionDays(days: number): number {
  if (!Number.isFinite(days)) return UNSUPPORTED_RETENTION_DAYS_DEFAULT;
  return Math.min(
    UNSUPPORTED_RETENTION_DAYS_MAX,
    Math.max(UNSUPPORTED_RETENTION_DAYS_MIN, Math.floor(days)),
  );
}

export interface RetentionPolicyInput {
  readonly verificationClass: WebhookVerificationClass;
  /** Operator-configured window for signature-valid, unreadable payloads. */
  readonly unsupportedRetentionDays: number;
}

export function webhookRetentionPolicy(input: RetentionPolicyInput): WebhookRetentionPolicy {
  switch (input.verificationClass) {
    case 'accepted':
      // The normalized payment event is an accounting record, not a diagnostic.
      return { retainRawBody: 'never', retentionDays: null };
    case 'ignored':
      return { retainRawBody: 'never', retentionDays: IGNORED_RETENTION_DAYS };
    case 'unsupported_schema':
      return {
        retainRawBody: 'encrypted',
        retentionDays: clampUnsupportedRetentionDays(input.unsupportedRetentionDays),
      };
    case 'unauthenticated':
      return { retainRawBody: 'never', retentionDays: UNAUTHENTICATED_RETENTION_DAYS };
  }
}

/** When the row should expire, or null when it is kept indefinitely. */
export function webhookRetainUntilMs(nowMs: number, policy: WebhookRetentionPolicy): number | null {
  return policy.retentionDays === null ? null : nowMs + policy.retentionDays * 86_400_000;
}
