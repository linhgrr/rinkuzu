import type {
  IBillingAlertRepository,
  PendingBillingAlert,
} from '@/interfaces/repositories/IBillingAlertRepository';
import {
  alertCooldownMs,
  alertDeliveryRetryMs,
  evaluateBillingAlerts,
  type BillingAlertSnapshot,
} from './billing-alerts';

/**
 * Turns the billing health counters into alerts, once each per cooldown.
 *
 * The order is deliberate and is the whole design: every alert is written to the
 * outbox first, and delivery is attempted afterwards. A condition detected while
 * no channel is configured is therefore still raised, still deduplicated, still
 * queryable and still counted — it simply carries the exact reason it could not
 * be sent. The alternative, trying to send first and recording only what
 * succeeded, makes a missing environment variable indistinguishable from a
 * healthy system.
 */

export interface AlertDispatchOutcome {
  /** Null when the alert was handed to a channel; the exact blocker otherwise. */
  readonly blocker: string | null;
}

/**
 * Where an alert goes once it is on the record.
 *
 * A port rather than a direct call because the channel is deployment
 * configuration: an installation with no ops channel is a supported
 * installation, and it must degrade to "raised, not delivered" rather than to
 * "not raised".
 */
export interface BillingAlertChannel {
  deliver(alert: PendingBillingAlert): Promise<AlertDispatchOutcome>;
}

export interface AlertingDeps {
  readonly alerts: IBillingAlertRepository;
  readonly channel: BillingAlertChannel;
  readonly clock: () => number;
  /**
   * The operator health counters the rules read. The same counters the admin
   * page shows, taken from the same place: two independent count queries over
   * one condition is how a dashboard and an alert start disagreeing about
   * whether anything is wrong.
   */
  readonly health: () => Promise<BillingAlertSnapshot>;
}

export interface RaisedAlertsResult {
  /** Conditions tripped on this tick, cooldown suppression already applied. */
  readonly raised: number;
  readonly delivered: number;
  /** Attempts refused on this tick; each of these is still queued. */
  readonly blocked: number;
  /** Distinct reasons delivery could not happen, for the caller to report. */
  readonly blockers: string[];
}

/** Bounded so one tick cannot spend its whole budget on a delivery backlog. */
const DISPATCH_LIMIT = 20;

export async function sweepBillingAlerts(deps: AlertingDeps): Promise<RaisedAlertsResult> {
  const snapshot = await deps.health();
  const nowMs = deps.clock();
  let raised = 0;
  for (const alert of evaluateBillingAlerts(snapshot)) {
    const claimed = await deps.alerts.raise({
      ...alert,
      nowMs,
      cooldownMs: alertCooldownMs(alert.severity),
    });
    if (claimed !== null) raised += 1;
  }

  // Everything still undelivered and due, not merely what this tick raised: an
  // alert that was raised while the channel was misconfigured must go out once
  // the channel comes back, without waiting for the condition to trip again.
  const due = await deps.alerts.listDueForDelivery({ nowMs, limit: DISPATCH_LIMIT });
  const blockers = new Set<string>();
  let delivered = 0;
  let blocked = 0;
  for (const alert of due) {
    const outcome = await deps.channel.deliver(alert);
    const atMs = deps.clock();
    if (outcome.blocker === null) {
      delivered += 1;
      await deps.alerts.recordDeliveryAttempt({
        alertRef: alert.alertRef,
        outcome: 'delivered',
        atMs,
      });
      continue;
    }
    // Still queued. The backoff is the only thing standing between a refusal
    // and the scheduler asking a broken channel again on every tick; retiring
    // the alert instead would be quieter and would lose it.
    blocked += 1;
    blockers.add(outcome.blocker);
    await deps.alerts.recordDeliveryAttempt({
      alertRef: alert.alertRef,
      outcome: 'blocked',
      atMs,
      blocker: outcome.blocker,
      retryAtMs: atMs + alertDeliveryRetryMs(alert.deliveryAttempts),
    });
  }

  return { raised, delivered, blocked, blockers: [...blockers] };
}
