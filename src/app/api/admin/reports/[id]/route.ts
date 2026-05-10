import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const { status } = await request.json();

    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      return apiErr('validation_error', 'Invalid status', 400);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.updateReportStatus(id, status);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.deleteReport(id);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
