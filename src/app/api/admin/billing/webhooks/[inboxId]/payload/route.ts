import { withWebhookRowAction } from '@/lib/api/webhook-row-action';
import { revealRetainedWebhookPayload } from '@/services/billing/webhooks/webhook-operations';

export const dynamic = 'force-dynamic';

/**
 * Reveals the one webhook body we retain.
 *
 * A POST, and one row at a time, because revealing is an action rather than a
 * view: the body is provider text that may name a payer, kept only so a parser
 * failure can be diagnosed, and it is written into the operator audit trail
 * before it is returned. The listing endpoint deliberately does not carry it —
 * a page of diagnostics that decrypts every retained body on the way past makes
 * "who has seen this?" a question with no answer.
 *
 * `no-store` on the way out: this is the one billing response that must not sit
 * in a shared cache, a browser's disk cache, or a proxy log.
 */
export const POST = withWebhookRowAction(
  'admin-reveal-webhook-payload',
  revealRetainedWebhookPayload,
  { 'Cache-Control': 'no-store' },
);
