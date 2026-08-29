/**
 * Which billing conditions are worth waking someone for.
 *
 * The operator page already counts these, and a counter on a page nobody has
 * open is not an alert — it is a number that goes up while money sits
 * uncollected. This module turns the same counters into a small set of named
 * conditions with a severity, a stable identity and a cooldown, so the queues
 * that only a person can clear announce themselves instead of waiting to be
 * noticed.
 *
 * Pure: no clock beyond what it is handed, no persistence, no delivery. What to
 * do with an alert is the outbox's problem; whether one is due is this
 * module's, and that is the part worth testing exhaustively.
 */

export const BILLING_ALERT_KEYS = [
  /** Money taken and no Premium granted. Nothing else in the system fixes it. */
  'paid_but_unfulfilled',
  /** Webhook deliveries that ran out of retries and are now doing nothing. */
  'webhook_dead_lettered',
  /** Attempts an operator has to resolve before their orders can move. */
  'attempts_in_review',
  /** Checkout links the provider never confirmed; a payable link may be live. */
  'attempts_indeterminate',
  /** Signature valid, body unreadable: the provider changed its contract. */
  'webhook_unsupported_schema',
  /** A burst of deliveries we could not authenticate; usually a key mismatch. */
  'webhook_checksum_failures',
  /** Deliveries naming an order we have no attempt for. */
  'webhook_orphaned',
] as const;
export type BillingAlertKey = (typeof BILLING_ALERT_KEYS)[number];

export const BILLING_ALERT_SEVERITIES = ['warning', 'critical'] as const;
export type BillingAlertSeverity = (typeof BILLING_ALERT_SEVERITIES)[number];

/** The counters an alert can be raised from; the operator health snapshot. */
export interface BillingAlertSnapshot {
  readonly paidButUnfulfilled: number;
  readonly attemptsInReview: number;
  readonly attemptsIndeterminate: number;
  readonly inboxOrphaned: number;
  readonly inboxDeadLettered: number;
  readonly webhooksUnsupportedSchema: number;
  readonly webhooksUnauthenticatedRecent: number;
}

export interface BillingAlert {
  readonly key: BillingAlertKey;
  readonly severity: BillingAlertSeverity;
  /** The count that tripped the rule, for the message and for the record. */
  readonly observed: number;
  readonly threshold: number;
  readonly summary: string;
  /** What the person woken up is supposed to do about it. */
  readonly action: string;
}

interface AlertRule {
  readonly key: BillingAlertKey;
  readonly severity: BillingAlertSeverity;
  readonly threshold: number;
  readonly read: (snapshot: BillingAlertSnapshot) => number;
  readonly summary: (observed: number) => string;
  readonly action: string;
}

/**
 * How many unauthenticated deliveries in the last day stop looking like
 * background noise and start looking like a checksum key that no longer
 * matches. Scanners hit the endpoint a handful of times; a provider retrying
 * every real payment does not.
 */
const CHECKSUM_FAILURE_THRESHOLD = 10;
/** A couple of orphans is timing; a pile of them is a misrouted merchant. */
const ORPHANED_THRESHOLD = 5;
const INDETERMINATE_THRESHOLD = 3;

const RULES: readonly AlertRule[] = [
  {
    key: 'paid_but_unfulfilled',
    severity: 'critical',
    threshold: 1,
    read: (snapshot) => snapshot.paidButUnfulfilled,
    summary: (observed) => `${observed} paid order(s) have no Premium granted`,
    action: 'Open the billing admin "Paid, not fulfilled" bucket and resolve each order.',
  },
  {
    key: 'webhook_dead_lettered',
    severity: 'critical',
    threshold: 1,
    read: (snapshot) => snapshot.inboxDeadLettered,
    summary: (observed) => `${observed} webhook(s) exhausted their retries`,
    action: 'Review the webhook diagnostics tab and replay each row once the cause is fixed.',
  },
  {
    key: 'webhook_unsupported_schema',
    severity: 'critical',
    threshold: 1,
    read: (snapshot) => snapshot.webhooksUnsupportedSchema,
    summary: (observed) => `${observed} signed webhook(s) carry a body we cannot parse`,
    action: 'Reveal a retained body, update the parser, then replay the affected rows.',
  },
  {
    key: 'webhook_checksum_failures',
    severity: 'critical',
    threshold: CHECKSUM_FAILURE_THRESHOLD,
    read: (snapshot) => snapshot.webhooksUnauthenticatedRecent,
    summary: (observed) => `${observed} webhook(s) failed signature checks in the last day`,
    action: 'Confirm PAYOS_CHECKSUM_KEY matches the key configured in the PayOS dashboard.',
  },
  {
    key: 'attempts_in_review',
    severity: 'warning',
    threshold: 1,
    read: (snapshot) => snapshot.attemptsInReview,
    summary: (observed) => `${observed} payment attempt(s) are waiting on an operator`,
    action: 'Reconcile each attempt against the provider dashboard and clear the review flag.',
  },
  {
    key: 'attempts_indeterminate',
    severity: 'warning',
    threshold: INDETERMINATE_THRESHOLD,
    read: (snapshot) => snapshot.attemptsIndeterminate,
    summary: (observed) => `${observed} checkout link(s) were never confirmed by the provider`,
    action: 'Check whether a payable link exists for each attempt before creating a replacement.',
  },
  {
    key: 'webhook_orphaned',
    severity: 'warning',
    threshold: ORPHANED_THRESHOLD,
    read: (snapshot) => snapshot.inboxOrphaned,
    summary: (observed) => `${observed} webhook(s) name an order we have no attempt for`,
    action: 'Confirm the merchant account and environment match the deliveries being received.',
  },
];

/**
 * Every condition currently tripped, most severe first.
 *
 * A rule fires on the count alone; the cooldown that stops it firing on every
 * tick is applied where the alert is claimed, because it needs durable state
 * and this does not.
 */
export function evaluateBillingAlerts(snapshot: BillingAlertSnapshot): BillingAlert[] {
  const raised = RULES.flatMap((rule) => {
    const observed = rule.read(snapshot);
    if (observed < rule.threshold) return [];
    return [
      {
        key: rule.key,
        severity: rule.severity,
        observed,
        threshold: rule.threshold,
        summary: rule.summary(observed),
        action: rule.action,
      } satisfies BillingAlert,
    ];
  });
  return raised.sort((left, right) => severityRank(right) - severityRank(left));
}

function severityRank(alert: BillingAlert): number {
  return alert.severity === 'critical' ? 1 : 0;
}

/**
 * How long a condition stays quiet after it has been announced.
 *
 * Long enough that a backlog nobody has cleared yet does not re-announce every
 * scheduler tick, short enough that a condition still standing tomorrow says so
 * again. A critical condition gets the shorter window: an order that has taken
 * money and granted nothing deserves a second reminder sooner than a queue of
 * unconfirmed checkout links.
 */
const COOLDOWN_MS: Record<BillingAlertSeverity, number> = {
  critical: 6 * 60 * 60_000,
  warning: 24 * 60 * 60_000,
};

export function alertCooldownMs(severity: BillingAlertSeverity): number {
  return COOLDOWN_MS[severity];
}

/**
 * How long a blocked alert waits before delivery is attempted again.
 *
 * Delivery failure and detection are separate concerns, and this is the price of
 * keeping them separate: an alert whose channel refused it stays queued, so
 * something has to stop the scheduler retrying the same refusal every tick. A
 * capped exponential wait does that without ever giving up — a missing
 * environment variable is fixed in minutes or in days, and either way the alert
 * that was raised while it was missing still goes out once it is fixed.
 *
 * The ceiling matters more than the base: it is the worst-case delay between
 * repairing the channel and hearing what was waiting behind it.
 */
const DELIVERY_RETRY_BASE_MS = 60_000;
const DELIVERY_RETRY_CEILING_MS = 30 * 60_000;
/** Beyond this the doubling has long since hit the ceiling; it only overflows. */
const DELIVERY_RETRY_MAX_DOUBLINGS = 20;

export function alertDeliveryRetryMs(failedAttempts: number): number {
  const doublings = Math.min(Math.max(failedAttempts, 0), DELIVERY_RETRY_MAX_DOUBLINGS);
  return Math.min(DELIVERY_RETRY_BASE_MS * 2 ** doublings, DELIVERY_RETRY_CEILING_MS);
}
