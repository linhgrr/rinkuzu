import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminSubscriptionService } from '@/lib/admin-subscription-factory';
import { adminSubscriptionListQuerySchema } from '@/dtos/admin-billing';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const adminSubscriptionService = getAdminSubscriptionService();

export const GET = withAdmin(async (request: NextRequest) => {
  const query = parseSearchParams(request, adminSubscriptionListQuerySchema);
  if (!query.ok) return query.response;

  const result = await adminSubscriptionService.listSubscriptions(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
