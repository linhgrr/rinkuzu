import { after } from 'next/server';
import { createBillingService } from '@/lib/billing-factory';
import { logger } from '@/lib/logger';

/**
 * Drains the payment-webhook inbox once the provider has had its answer.
 *
 * A paid order used to become Premium on the next scheduler tick, which is
 * why that tick ran every minute and cost a Function invocation a minute while
 * nothing was queued (RIN-1625). The webhook that fills the inbox now starts
 * the drain itself, so the event and not the clock decides how fast money
 * turns into an entitlement, and the scheduler only has to catch a kick that
 * was lost (a crash, a timeout, a cold Mongo). The drain leases each row, so
 * a kick and a cron tick running together cannot settle the same event twice.
 *
 * The provider is answered first: a slow drain must not turn into a webhook
 * timeout and a redelivery. A failed kick is logged and otherwise ignored,
 * because the row it would have processed is still in the inbox.
 */
export function kickWebhookInboxDrain(): void {
  after(async () => {
    try {
      const result = await createBillingService().processInbox();
      if (result.claimed > 0) logger.info({ ...result }, 'Payment webhook drained on arrival');
    } catch (error) {
      logger.warn({ error }, 'Payment webhook drain on arrival failed; the scheduler retries it');
    }
  });
}
