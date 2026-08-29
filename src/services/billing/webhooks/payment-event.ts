import type {
  RecordPaymentEventInput,
  WebhookRequestFacts,
} from '@/interfaces/repositories/IWebhookInboxRepository';
import type { AcceptedPayOSWebhook } from '../payos-webhook';

/**
 * One accepted webhook, as the inbox needs to record it.
 *
 * Two callers reach this — the live endpoint and an operator replaying a body
 * the parser could not read at the time — and they have to record the identical
 * set of facts. A field added to the payment event in one and not the other is
 * a money fact that exists for deliveries and not for replays, which is exactly
 * the sort of divergence nobody notices until an audit.
 */
export function paymentEventFromWebhook(
  outcome: AcceptedPayOSWebhook,
  facts: WebhookRequestFacts,
): RecordPaymentEventInput {
  return {
    facts,
    orderCode: outcome.payload.orderCode,
    amount: outcome.payload.amount,
    currency: outcome.payload.currency,
    paymentLinkId: outcome.payload.paymentLinkId,
    reference: outcome.payload.reference,
    transactionDateTime: outcome.payload.transactionDateTime,
    counterAccountBankId: outcome.payload.counterAccountBankId,
    counterAccountNumber: outcome.payload.counterAccountNumber,
  };
}
