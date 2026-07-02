import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingService } from '@/lib/admin-billing-factory';
import { adminSubscriptionListQuerySchema } from '@/dtos/admin-billing';

export const dynamic = 'force-dynamic';

const adminBillingService = getAdminBillingService();

export const GET = withAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = adminSubscriptionListQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });
  if (!query.success) {
    return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid query', 400);
  }

  const result = await adminBillingService.listSubscriptions(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
