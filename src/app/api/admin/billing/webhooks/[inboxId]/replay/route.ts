import { withWebhookRowAction } from '@/lib/api/webhook-row-action';
import { replayWebhookEvent } from '@/services/billing/webhooks/webhook-operations';

export const dynamic = 'force-dynamic';

/**
 * Gives a stalled webhook another run.
 *
 * Before this the only way to retry a dead-lettered delivery was to edit its
 * status in the database — an unauditable write in the one collection where an
 * unauditable write is indistinguishable from an attack. A replay is an
 * operator action now, and it works on the row that already exists rather than
 * posting a body back at the public endpoint: re-entering there would mean
 * re-deriving a provider signature we do not hold and would open a second,
 * unauthenticated path into settlement.
 *
 * Idempotency is unchanged, because it never belonged to the delivery: money is
 * identified by the provider's own transaction reference, so a replayed event
 * collapses onto the transaction already recorded.
 */
export const POST = withWebhookRowAction('admin-replay-webhook', replayWebhookEvent);
