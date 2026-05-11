import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// POST /api/admin/setup - Create default admin account (only if no admin exists)
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.initializeSystem();

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Admin setup error:', error);
    return apiErr('internal_error', 'Failed to initialize system', 500);
  }
}

// GET /api/admin/setup - Check if admin setup is needed
export async function GET() {
  try {
    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getStats();
    if (!result.success || !result.data) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 500);
    }

    return apiOk({
      adminExists: result.data.totalAdmins > 0,
      setupAllowed: result.data.totalAdmins === 0,
      userCount: result.data.totalUsers,
      message: 'Setup status checked',
    });
  } catch (error: any) {
    console.error('Admin setup check error:', error);
    return apiErr('internal_error', 'Failed to check admin setup status', 500);
  }
}
