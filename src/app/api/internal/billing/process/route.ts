import { withInternalBillingTick } from '@/lib/api/internal-billing-tick';
import { createBillingIdleProbe } from '@/lib/billing-factory';
import { logger } from '@/lib/logger';

// The drain calls the payment provider once per queued event, so it needs more
// than the platform default. Must stay above the repository's batch budget.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = withInternalBillingTick('process-inbox', async (service, tick) => {
  // The webhook drains its own row on arrival (RIN-1625), so this tick is a
  // safety net and is idle almost every time. Two index seeks decide that
  // before a transaction is opened for a claim that would find nothing.
  if (!(await createBillingIdleProbe().hasDueInboxWork(Date.now()))) {
    return { claimed: 0, processed: 0, exhaustedBudget: false };
  }
  const result = await service.processInbox();
  // A tick that found nothing says nothing: the scheduler runs continuously
  // and an "idle" line per tick buries the two lines that matter.
  if (result.exhaustedBudget) {
    logger.warn({ tick, ...result }, 'Payment webhook inbox drain stopped on its time budget');
  } else if (result.claimed > 0) {
    logger.info({ tick, ...result }, 'Payment webhook inbox drained');
  }
  return result;
});
