import type { NextRequest } from 'next/server';
import { billingOrderParamsSchema, externalMoneyAdjustmentSchema } from '@/dtos/billing';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';

export const POST = withAdmin<{ orderId: string }>(
  async (request: NextRequest, { userId, params }) => {
    try {
      assertBillingMutationRequest(request);
      const route = readAndValidateRouteParams(params, billingOrderParamsSchema);
      if (!route.success) {
        return apiErr('validation_error', route.error, 400, { fields: route.fields });
      }
      const body = await readAndValidateJson(request, externalMoneyAdjustmentSchema);
      if (!body.success) {
        return apiErr('validation_error', body.error, 400, { fields: body.fields });
      }
      if (body.data.orderId !== route.data.orderId) {
        return apiErr('validation_error', 'Order ID does not match route', 400);
      }
      return apiOk(
        await createBillingService().recordExternalMoneyAdjustment({
          ...body.data,
          recordedBy: userId,
        }),
      );
    } catch (error) {
      return billingHttpError(error, 'admin-record-external-adjustment');
    }
  },
);
