import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { buildPaginationMeta } from '@/repositories/pagination';
import { apiErr } from '@/lib/api/response';

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

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const result = await subscriptionService.getSubscriptionHistory('');

    // Filter and paginate results based on search params
    let filteredResults = result;
    if (searchParamsObj.status) {
      const normalizedStatus =
        searchParamsObj.status === 'active' ? 'completed' : searchParamsObj.status;
      filteredResults = result.filter((sub: any) => sub.status === normalizedStatus);
    }
    if (searchParamsObj.search) {
      const searchLower = searchParamsObj.search.toLowerCase();
      filteredResults = filteredResults.filter(
        (sub: any) =>
          sub.userEmail?.toLowerCase().includes(searchLower) ||
          sub.payosOrderId?.toLowerCase().includes(searchLower),
      );
    }

    const page = parseInt(searchParamsObj.page || '1');
    const limit = parseInt(searchParamsObj.limit || '20');
    const total = filteredResults.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = filteredResults.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: paginatedResults,
        pagination: buildPaginationMeta(page, limit, total),
      },
    });
  } catch (error: any) {
    console.error('Admin subscriptions list error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
