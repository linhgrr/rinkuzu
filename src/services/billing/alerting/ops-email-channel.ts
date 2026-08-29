import 'server-only';

import { logger } from '@/lib/logger';
import { sendCommunicationEmail } from '@/lib/communication/resend';
import type { PendingBillingAlert } from '@/interfaces/repositories/IBillingAlertRepository';
import type { AlertDispatchOutcome, BillingAlertChannel } from './raise-alerts';

/**
 * The ops mailbox, reached through the same transport every other outbound mail
 * uses.
 *
 * Two environment variables have to be present for an alert to leave the
 * building, and when either is missing this returns the name of the one that is
 * — as a blocker recorded on the alert and reported by the scheduler, not as a
 * warning in a log nobody reads. The alert itself is already on the record by
 * the time this runs, so a missing mailbox degrades delivery and never
 * detection.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class OpsEmailAlertChannel implements BillingAlertChannel {
  async deliver(alert: PendingBillingAlert): Promise<AlertDispatchOutcome> {
    const to = process.env['BILLING_ALERT_EMAIL']?.trim();
    const from = process.env['MAIL_FROM']?.trim();
    if (!to) return { blocker: 'BILLING_ALERT_EMAIL is not configured' };
    if (!from) return { blocker: 'MAIL_FROM is not configured' };

    const subject = `[billing/${alert.severity}] ${alert.summary}`;
    const text = `${alert.summary}\n\nWhat to do: ${alert.action}\n\nSignal: ${alert.key} (${alert.observed} observed)`;
    try {
      await sendCommunicationEmail({
        to,
        from,
        subject: subject.slice(0, 200),
        html: `<p>${escapeHtml(alert.summary)}</p><p><strong>What to do:</strong> ${escapeHtml(alert.action)}</p><p>Signal <code>${escapeHtml(alert.key)}</code>, ${alert.observed} observed.</p>`,
        text,
        entityType: 'billing_alert',
        entityId: alert.key,
        // The alert row is raised once per cooldown, so its id is already the
        // natural idempotency key for exactly one delivery of one condition.
        idempotencyKey: `billing-alert:${alert.alertRef}`,
      });
      return { blocker: null };
    } catch (error) {
      const blocker = error instanceof Error ? error.message : 'Alert delivery failed';
      logger.error({ err: error, alertKey: alert.key }, 'Billing alert delivery failed');
      return { blocker: blocker.slice(0, 500) };
    }
  }
}
