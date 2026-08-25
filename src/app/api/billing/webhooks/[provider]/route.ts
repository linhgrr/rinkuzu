import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { billingWebhookParamsSchema } from '@/dtos/billing';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { BillingDomainError } from '@/services/billing/billing-domain';
import { billingHttpError } from '@/services/billing/billing-http';
import { parseAndVerifyPayOSWebhook } from '@/services/billing/payos-webhook';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  let rawBody = '';
  try {
    const params = readAndValidateRouteParams(await context.params, billingWebhookParamsSchema);
    if (!params.success) return apiErr('not_found', 'Payment provider not found', 404);
    rawBody = await request.text();
    const verified = parseAndVerifyPayOSWebhook(rawBody);
    if (verified.ignored) return apiOk(null, 200, { meta: { message: 'Webhook ignored' } });
    const result = await createBillingService().persistVerifiedPayOSWebhook({
      rawPayloadHash: verified.rawPayloadHash,
      orderCode: verified.payload.orderCode,
      amount: verified.payload.amount,
      currency: verified.payload.currency,
      paymentLinkId: verified.payload.paymentLinkId,
      reference: verified.payload.reference,
      transactionDateTime: verified.payload.transactionDateTime,
      counterAccountBankId: verified.payload.counterAccountBankId,
      counterAccountNumber: verified.payload.counterAccountNumber,
    });
    return apiOk(result, 200);
  } catch (error) {
    if (error instanceof BillingDomainError && error.code === 'unsupported_webhook_schema') {
      const rawPayloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
      try {
        const result = await createBillingService().persistUnsupportedPayOSWebhook(rawPayloadHash);
        return apiOk(result, 200, {
          meta: { message: 'Verified webhook schema is unsupported' },
        });
      } catch (persistenceError) {
        return billingHttpError(persistenceError, 'payos-unsupported-webhook');
      }
    }
    return billingHttpError(error, 'payos-webhook');
  }
}
