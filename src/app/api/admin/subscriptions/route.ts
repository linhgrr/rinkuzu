import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAdmin } from '@/lib/api/auth';
import { buildPaginationMeta } from '@/repositories/pagination';
import { apiErr, apiOk } from '@/lib/api/response';
import type { ISubscription } from '@/models/Subscription';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const searchParamsObj = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
    };

    const subscriptionService = createSubscriptionService();
    const result = await subscriptionService.getSubscriptionHistory('');

    // Filter and paginate results based on search params
    let filteredResults: ISubscription[] = result;
    if (searchParamsObj.status) {
      filteredResults = result.filter((sub) => sub.status === searchParamsObj.status);
    }
    if (searchParamsObj.search) {
      const searchLower = searchParamsObj.search.toLowerCase();
      filteredResults = filteredResults.filter(
        (sub) =>
          sub.userEmail?.toLowerCase().includes(searchLower) ||
          sub.payosOrderId?.toLowerCase().includes(searchLower),
      );
    }

    const page = parseInt(searchParamsObj.page || '1');
    const limit = parseInt(searchParamsObj.limit || '20');
    const total = filteredResults.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = filteredResults.slice(startIndex, startIndex + limit);

    return apiOk({
      subscriptions: paginatedResults,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error: unknown) {
    console.error('Admin subscriptions list error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
