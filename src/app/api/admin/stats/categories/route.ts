import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (_request: NextRequest) => {
  try {
    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getCategoryStats();

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error fetching category stats:', error);
    return apiErr('internal_error', 'Failed to fetch category statistics', 500);
  }
});
