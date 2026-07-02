import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingService } from '@/lib/admin-billing-factory';
import { adminSubscriptionListQuerySchema } from '@/dtos/admin-billing';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

const adminBillingService = getAdminBillingService();

export const GET = withAdmin(async (request: NextRequest) => {
  const query = readAndValidateSearchParams(request, adminSubscriptionListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await adminBillingService.listSubscriptions(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
