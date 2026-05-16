import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Unauthorized - Admin access required', 401);
    }

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
}
