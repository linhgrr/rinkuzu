import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (_request: NextRequest) => {
  try {
    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getCreatorStats();

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error fetching creator stats:', error);
    return apiErr('internal_error', 'Failed to fetch creator statistics', 500);
  }
});
