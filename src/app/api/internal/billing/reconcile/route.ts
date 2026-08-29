import { withInternalBillingTick } from '@/lib/api/internal-billing-tick';
import { createAlertingDeps } from '@/lib/billing-factory';
import { logger } from '@/lib/logger';
import { sweepBillingAlerts } from '@/services/billing/alerting/raise-alerts';
import {
  ALERT_SWEEP_BUDGET_MS,
  DEFAULT_BATCH_BUDGET_MS,
} from '@/services/billing/settlement/drains';

// One provider round trip per due attempt. Must stay above the repository's
// batch budget so the batch, not the platform, decides when to stop.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = withInternalBillingTick('reconcile-attempts', async (service, tick) => {
  // The drain gets the batch budget less the sweep's reserve, so the alert
  // pass at the end of this request is not left running on borrowed time.
  const result = await service.reconcileDueAttempts({
    budgetMs: DEFAULT_BATCH_BUDGET_MS - ALERT_SWEEP_BUDGET_MS,
  });
  if (result.exhaustedBudget) {
    logger.warn({ tick, ...result }, 'Payment attempt reconciliation stopped on its time budget');
  } else if (result.processed > 0 || result.failed > 0) {
    logger.info({ tick, ...result }, 'Payment attempts reconciled');
  }

  // The queues only a person can clear are checked on the same schedule that
  // fills them. A counter on a page nobody has open is not an alert, and this
  // is the one tick that already runs whether or not anyone is looking.
  const alerts = await sweepBillingAlerts(createAlertingDeps());
  if (alerts.blockers.length > 0) {
    logger.error(
      { tick, blockers: alerts.blockers, raised: alerts.raised },
      'Billing alerts were raised but could not be delivered',
    );
  } else if (alerts.raised > 0) {
    logger.warn({ tick, raised: alerts.raised }, 'Billing alerts raised');
  }
  return { ...result, alerts };
});
