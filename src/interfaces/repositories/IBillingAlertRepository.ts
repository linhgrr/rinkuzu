import type {
  BillingAlertKey,
  BillingAlertSeverity,
} from '@/services/billing/alerting/billing-alerts';

/**
 * The billing alert outbox.
 *
 * An alert is written down before anything tries to deliver it, and delivery is
 * a separate concern that may not be configured at all. That order matters: a
 * condition that was detected but could not be sent anywhere must still be
 * visible and still be counted, rather than disappearing into a log line
 * because a channel was missing. The outbox is the fail-closed record; the
 * channel is best-effort on top of it.
 */

export interface RaiseBillingAlertInput {
  readonly key: BillingAlertKey;
  readonly severity: BillingAlertSeverity;
  readonly observed: number;
  readonly threshold: number;
  readonly summary: string;
  readonly action: string;
  readonly nowMs: number;
  /** How long this key stays quiet after being raised. */
  readonly cooldownMs: number;
}

export interface PendingBillingAlert {
  readonly alertRef: string;
  readonly key: BillingAlertKey;
  readonly severity: BillingAlertSeverity;
  readonly summary: string;
  readonly action: string;
  readonly observed: number;
  readonly raisedAtMs: number;
  /** Deliveries already refused for this alert; 0 on the first attempt. */
  readonly deliveryAttempts: number;
}

/** The delivery-queue read: what is undelivered and due, bounded. */
export interface ListDueAlertsInput {
  readonly nowMs: number;
  readonly limit: number;
}

/**
 * What one delivery attempt did, as two shapes rather than one shape with a
 * nullable reason.
 *
 * The distinction is the whole correctness property of the outbox: only
 * `delivered` retires an alert from the queue, and a `blocked` attempt has to
 * carry both why it failed and when to try again. Collapsing the two into a
 * single record with an optional blocker is what let a failed delivery be
 * written down as a successful one.
 */
export type AlertDeliveryAttempt =
  | {
      readonly alertRef: string;
      readonly outcome: 'delivered';
      readonly atMs: number;
    }
  | {
      readonly alertRef: string;
      readonly outcome: 'blocked';
      readonly atMs: number;
      /** The exact reason delivery could not happen, verbatim. */
      readonly blocker: string;
      /** Not before this instant is the alert offered to a channel again. */
      readonly retryAtMs: number;
    };

export interface IBillingAlertRepository {
  /**
   * Records the alert unless the same key is still inside its cooldown.
   *
   * Returns the row when this call is the one that raised it and null when the
   * condition is already announced, so a scheduler running every minute
   * produces one alert per cooldown rather than one per tick. The suppression
   * is a single atomic upsert: two schedulers racing produce one alert.
   */
  raise(input: RaiseBillingAlertInput): Promise<PendingBillingAlert | null>;
  /**
   * Alerts still undelivered and due for another attempt, oldest first.
   *
   * Due, not merely undelivered: an alert a channel has already refused waits
   * out its backoff here rather than being retried on every scheduler tick.
   */
  listDueForDelivery(input: ListDueAlertsInput): Promise<PendingBillingAlert[]>;
  /**
   * Records the attempt and, only when it succeeded, retires the alert.
   *
   * A blocked attempt must leave the alert in the queue. Marking it delivered
   * anyway is indistinguishable from success at every later read, and the
   * condition then goes unannounced until its cooldown expires — which is the
   * opposite of what an alert is for.
   */
  recordDeliveryAttempt(attempt: AlertDeliveryAttempt): Promise<void>;
}
