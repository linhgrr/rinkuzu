import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const searchParamsObj = {
      status: searchParams.get('status'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getReports(searchParamsObj);

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
