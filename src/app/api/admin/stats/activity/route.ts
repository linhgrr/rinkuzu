import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Unauthorized - Admin access required', 401);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getActivityStats();

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    return apiErr('internal_error', 'Failed to fetch activity statistics', 500);
  }
}
