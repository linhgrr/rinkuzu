import type { NextRequest } from 'next/server';
import { createBillingOrderRequestSchema } from '@/dtos/billing';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingOrderRepository } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { consumeBillingRateLimit } from '@/lib/billing-rate-limit';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    assertBillingMutationRequest(request);
    await consumeBillingRateLimit('order_create_user', userId);
    const parsed = await readAndValidateJson(request, createBillingOrderRequestSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const idempotencyKey = request.headers.get('idempotency-key') ?? '';
    const result = await createBillingOrderRepository().createOrder({
      userId,
      quoteToken: parsed.data.quoteToken,
      idempotencyKey,
    });
    return apiOk(result.order, result.status);
  } catch (error) {
    return billingHttpError(error, 'create-order');
  }
});
