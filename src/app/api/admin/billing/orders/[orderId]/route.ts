import type { NextRequest } from 'next/server';
import { adminBillingOrderRouteParamsSchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingOrdersService } from '@/lib/admin-billing-orders-factory';
import { parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAdmin<{ orderId: string }>(async (_request: NextRequest, { params }) => {
  const route = parseRouteParams(params, adminBillingOrderRouteParamsSchema);
  if (!route.ok) return route.response;

  const result = await getAdminBillingOrdersService().getOrderDetail(route.data.orderId);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
