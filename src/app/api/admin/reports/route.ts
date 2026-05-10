import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const searchParamsObj = {
      status: searchParams.get('status'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getReports(searchParamsObj);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
