import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Report id is required', 400);
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
  } catch (error: unknown) {
    console.error('Error updating report:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAdmin(async (request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Report id is required', 400);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.deleteReport(id);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return apiOk(null, 200, { message: 'Report deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting report:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
