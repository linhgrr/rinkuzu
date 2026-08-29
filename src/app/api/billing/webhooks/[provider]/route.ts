import type { NextRequest } from 'next/server';
import { billingWebhookParamsSchema } from '@/dtos/billing';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createWebhookInboxRepository } from '@/lib/billing-factory';
import { consumeBillingRateLimit } from '@/lib/billing-rate-limit';
import type {
  IWebhookInboxRepository,
  WebhookRequestFacts,
} from '@/interfaces/repositories/IWebhookInboxRepository';
import { billingHttpError } from '@/services/billing/billing-http';
import { hashRequestSourceIp, webhookAbuseBucket } from '@/services/billing/billing-security';
import {
  classifyPayOSWebhook,
  MAX_WEBHOOK_BYTES,
  webhookRejectionErrorCode,
  webhookRejectionStatus,
  webhookVerificationClass,
  type PayOSWebhookOutcome,
} from '@/services/billing/payos-webhook';
import { paymentEventFromWebhook } from '@/services/billing/webhooks/payment-event';

export const dynamic = 'force-dynamic';

/**
 * The provider's delivery endpoint.
 *
 * Every request this endpoint reads leaves a row behind — accepted, ignored,
 * unreadable or unauthenticated alike. A webhook that is silently dropped is
 * indistinguishable from one that never arrived, and that is precisely the
 * situation an operator is in after a one-sided checksum key change: money
 * stops moving and nothing anywhere records why.
 *
 * Two deliberate exceptions, both of which answer before the body is read and
 * therefore write nothing: a body larger than the ceiling, and a source that
 * has spent its unauthenticated budget. Persisting either would hand an
 * anonymous caller the write amplification the limits exist to deny, so the
 * limiter's own counters — not the inbox — are the record that they happened.
 *
 * Rejections are answered with the status their reason earns rather than a
 * blanket 200, so the provider's own delivery dashboard shows the failure too.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  try {
    const params = readAndValidateRouteParams(await context.params, billingWebhookParamsSchema);
    if (!params.success) return apiErr('not_found', 'Payment provider not found', 404);

    // The earliest point the platform lets us refuse an oversized body: a
    // declared length is checked before a single byte is buffered. A caller
    // that lies about it, or omits it, is still caught by the byte count after
    // the read — but the honest common case never reaches the buffer at all.
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return apiErr('validation_error', 'Webhook body exceeds the size limit', 413);
    }

    // Charged before the body is read, and never null: a delivery the platform
    // could not attribute is charged to a shared bucket rather than escaping
    // the ceiling entirely.
    const abuseBucket = webhookAbuseBucket(request);

    const rawBody = await request.text();
    const outcome = classifyPayOSWebhook(rawBody);
    const facts: WebhookRequestFacts = {
      rawPayloadHash: outcome.rawPayloadHash,
      byteSizeBytes: outcome.byteSize,
      sourceIpHash: hashRequestSourceIp(request),
    };
    const inbox = createWebhookInboxRepository();

    if (outcome.kind === 'accepted') {
      const result = await inbox.recordPaymentEvent(paymentEventFromWebhook(outcome, facts));
      return apiOk(result, 200);
    }

    if (outcome.kind === 'rejected') {
      // Charged only for traffic we could not authenticate, and charged before
      // the write, so a flood is bounded by the limiter rather than by how fast
      // the database can absorb diagnostics. A request refused here throws past
      // the write below and is deliberately not persisted.
      await consumeBillingRateLimit('webhook_unauthenticated', abuseBucket);
      await recordDiagnostic(inbox, facts, outcome);
      return apiErr(
        webhookRejectionErrorCode(outcome.reason),
        'Webhook was rejected',
        webhookRejectionStatus(outcome.reason),
      );
    }

    const result = await recordDiagnostic(inbox, facts, outcome);
    return apiOk(result, 200, {
      meta: {
        message:
          outcome.kind === 'ignored'
            ? 'Webhook recorded; no payment to apply'
            : 'Verified webhook schema is unsupported',
      },
    });
  } catch (error) {
    return billingHttpError(error, 'payos-webhook');
  }
}

function recordDiagnostic(
  inbox: IWebhookInboxRepository,
  facts: WebhookRequestFacts,
  outcome: Exclude<PayOSWebhookOutcome, { kind: 'accepted' }>,
): ReturnType<IWebhookInboxRepository['recordDiagnostic']> {
  return inbox.recordDiagnostic({
    facts,
    verificationClass: webhookVerificationClass(outcome),
    rejectionReason: outcome.kind === 'rejected' ? outcome.reason : null,
    eventCode: outcome.kind === 'ignored' ? outcome.eventCode : null,
    eventDesc: outcome.kind === 'ignored' ? outcome.eventDesc : null,
    orderCode: outcome.kind === 'ignored' ? outcome.orderCode : null,
    rawBody: outcome.kind === 'unsupported_schema' ? outcome.rawBody : null,
  });
}
