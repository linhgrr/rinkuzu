import { withInternalBillingTick } from '@/lib/api/internal-billing-tick';
import { logger } from '@/lib/logger';

// The drain calls the payment provider once per queued event, so it needs more
// than the platform default. Must stay above the repository's batch budget.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = withInternalBillingTick('process-inbox', async (service, tick) => {
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
