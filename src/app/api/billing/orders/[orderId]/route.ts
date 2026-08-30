import type { NextRequest } from 'next/server';
import { billingOrderParamsSchema } from '@/dtos/billing';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { createBillingOrderRepository } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { parseRouteParams } from '@/lib/api/validated';

export const GET = withAuth<{ orderId: string }>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const parsed = parseRouteParams(params, billingOrderParamsSchema);
      if (!parsed.ok) return parsed.response;
      return apiOk(
        await createBillingOrderRepository().getOrderByPublicId(userId, parsed.data.orderId),
      );
    } catch (error) {
      return billingHttpError(error, 'get-order');
    }
  },
);
