import { NextRequest } from 'next/server';
import { adminBillingOrderListQuerySchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingOrdersService } from '@/lib/admin-billing-orders-factory';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  const query = parseSearchParams(request, adminBillingOrderListQuerySchema);
  if (!query.ok) return query.response;

  const result = await getAdminBillingOrdersService().listOrders(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
