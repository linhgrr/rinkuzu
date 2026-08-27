import { NextRequest } from 'next/server';
import { adminBillingOrderListQuerySchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingOrdersService } from '@/lib/admin-billing-orders-factory';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  const query = readAndValidateSearchParams(request, adminBillingOrderListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await getAdminBillingOrdersService().listOrders(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
