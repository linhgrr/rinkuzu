import type { NextRequest } from 'next/server';
import { adminBillingOrderRouteParamsSchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingOrdersService } from '@/lib/admin-billing-orders-factory';

export const dynamic = 'force-dynamic';

export const GET = withAdmin<{ orderId: string }>(async (_request: NextRequest, { params }) => {
  const route = readAndValidateRouteParams(params, adminBillingOrderRouteParamsSchema);
  if (!route.success) {
    return apiErr('validation_error', route.error, 400, { fields: route.fields });
  }

  const result = await getAdminBillingOrdersService().getOrderDetail(route.data.orderId);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
