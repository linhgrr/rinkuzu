import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { BillingAlert } from '@/models/Billing';
import type {
  AlertDeliveryAttempt,
  IBillingAlertRepository,
  ListDueAlertsInput,
  PendingBillingAlert,
  RaiseBillingAlertInput,
} from '@/interfaces/repositories/IBillingAlertRepository';
import {
  BILLING_ALERT_KEYS,
  BILLING_ALERT_SEVERITIES,
} from '@/services/billing/alerting/billing-alerts';
import type { BillingAlertPersistenceRecord } from '@/repositories/types/BillingPersistence';
import { assertStoredEnum } from './billing-shared';

function toPending(row: BillingAlertPersistenceRecord): PendingBillingAlert {
  return {
    alertRef: row._id.toString(),
    key: assertStoredEnum(BILLING_ALERT_KEYS, row.key, 'billing alert key'),
    severity: assertStoredEnum(BILLING_ALERT_SEVERITIES, row.severity, 'billing alert severity'),
    summary: row.summary,
    action: row.action,
    observed: row.observed,
    raisedAtMs: row.raisedAt.getTime(),
    deliveryAttempts: row.dispatchAttempts ?? 0,
  };
}

export class BillingAlertRepository implements IBillingAlertRepository {
  /**
   * One conditional upsert is the whole deduplication mechanism.
   *
   * The filter demands either no row for this key or one whose cooldown has
   * expired, so a scheduler running every minute against a backlog nobody has
   * cleared writes exactly once per cooldown, and two schedulers racing write
   * once between them — the loser's filter no longer matches the row the winner
   * just refreshed.
   */
  async raise(input: RaiseBillingAlertInput): Promise<PendingBillingAlert | null> {
    await connectDB();
    const now = new Date(input.nowMs);
    try {
      const raised = await BillingAlert.findOneAndUpdate(
        {
          key: input.key,
          $or: [{ cooldownUntil: { $exists: false } }, { cooldownUntil: { $lte: now } }],
        },
        {
          $set: {
            key: input.key,
            severity: input.severity,
            observed: input.observed,
            threshold: input.threshold,
            summary: input.summary,
            action: input.action,
            raisedAt: now,
            cooldownUntil: new Date(input.nowMs + input.cooldownMs),
          },
          // A re-raised condition is a new thing to deliver: the previous
          // delivery verdict, its backoff and its attempt count all go, or an
          // alert raised again after a run of refusals would inherit the
          // half-hour wait those refusals earned.
          $unset: {
            dispatchedAt: 1,
            dispatchBlocker: 1,
            dispatchRetryAt: 1,
            dispatchAttempts: 1,
          },
        },
        { new: true, upsert: true },
      )
        .lean<BillingAlertPersistenceRecord>()
        .exec();
      return raised ? toPending(raised) : null;
    } catch (error) {
      // The unique key rejected the upsert because a row exists and is still
      // inside its cooldown. That is the suppression working, not a failure.
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    }
  }

  /**
   * The delivery queue: undelivered, and past whatever backoff a refusal set.
   *
   * `dispatchedAt` leads the compound index and is the selective half of the
   * predicate; `dispatchRetryAt` narrows what that leaves. The collection holds
   * one row per alert key by construction — the unique index above — so the
   * residual scan is over a handful of documents and does not want an index of
   * its own.
   */
  async listDueForDelivery(input: ListDueAlertsInput): Promise<PendingBillingAlert[]> {
    await connectDB();
    const now = new Date(input.nowMs);
    const rows = await BillingAlert.find({
      dispatchedAt: { $exists: false },
      $or: [{ dispatchRetryAt: { $exists: false } }, { dispatchRetryAt: { $lte: now } }],
    })
      .sort({ raisedAt: 1 })
      .limit(input.limit)
      .lean<BillingAlertPersistenceRecord[]>()
      .exec();
    return rows.map(toPending);
  }

  /**
   * Success sets `dispatchedAt` and nothing else does.
   *
   * A refusal writes the reason, the next attempt time and one more attempt on
   * the counter, and deliberately leaves `dispatchedAt` absent so the row is
   * still in the queue the sweep reads. That absence is the retry.
   */
  async recordDeliveryAttempt(attempt: AlertDeliveryAttempt): Promise<void> {
    await connectDB();
    const _id = new Types.ObjectId(attempt.alertRef);
    if (attempt.outcome === 'delivered') {
      await BillingAlert.updateOne(
        { _id },
        {
          $set: { dispatchedAt: new Date(attempt.atMs) },
          $unset: { dispatchBlocker: 1, dispatchRetryAt: 1 },
        },
      );
      return;
    }
    await BillingAlert.updateOne(
      { _id },
      {
        $set: {
          dispatchBlocker: attempt.blocker.slice(0, 500),
          dispatchRetryAt: new Date(attempt.retryAtMs),
          lastDispatchAttemptAt: new Date(attempt.atMs),
        },
        $inc: { dispatchAttempts: 1 },
      },
    );
  }
}
