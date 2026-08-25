import type { NextRequest } from 'next/server';
import { billingOrderParamsSchema } from '@/dtos/billing';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';

export const GET = withAuth<{ orderId: string }>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const parsed = readAndValidateRouteParams(params, billingOrderParamsSchema);
      if (!parsed.success) {
        return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
      }
      return apiOk(await createBillingService().getOrderByPublicId(userId, parsed.data.orderId));
    } catch (error) {
      return billingHttpError(error, 'get-order');
    }
  },
);
