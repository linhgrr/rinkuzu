import type { NextRequest } from 'next/server';
import { billingOrderParamsSchema } from '@/dtos/billing';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { consumeBillingRateLimit } from '@/lib/billing-rate-limit';

export const POST = withAuth<{ orderId: string }>(
  async (request: NextRequest, { userId, params }) => {
    try {
      assertBillingMutationRequest(request);
      await consumeBillingRateLimit('order_attempt_user', userId);
      const parsed = readAndValidateRouteParams(params, billingOrderParamsSchema);
      if (!parsed.success) {
        return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
      }
      const result = await createBillingService().createReplacementAttempt(
        userId,
        parsed.data.orderId,
      );
      return apiOk(result.order, result.status);
    } catch (error) {
      return billingHttpError(error, 'create-attempt');
    }
  },
);
