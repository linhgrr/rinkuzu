import type { NextRequest } from 'next/server';
import { billingQuoteRequestSchema } from '@/dtos/billing';
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
    await consumeBillingRateLimit('quote_user', userId);
    const parsed = await readAndValidateJson(request, billingQuoteRequestSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    return apiOk(
      await createBillingOrderRepository().quote(userId, parsed.data.planId, parsed.data.promoCode),
    );
  } catch (error) {
    return billingHttpError(error, 'quote');
  }
});
