import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// POST /api/admin/setup - Create default admin account (only if no admin exists)
export const POST = withAdmin(async (_request: NextRequest) => {
  try {
    const adminService = serviceFactory.getAdminService();
    const result = await adminService.initializeSystem();

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    const message =
      result.data &&
      typeof (result.data as { message?: unknown }).message === 'string' &&
      ((result.data as { message: string }).message.trim()
        ? (result.data as { message: string }).message
        : 'System initialized');

    return apiOk(null, 200, {
      meta: { message: message || 'System initialized' },
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    return apiErr('internal_error', 'Failed to initialize system', 500);
  }
});

// GET /api/admin/setup - Check if admin setup is needed
// Public endpoint: no auth required (used during initial setup before any admin exists)
export async function GET() {
  try {
    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getStats();
    if (!result.success) {
      return apiServiceErr(result, 500);
    }
    const stats = result.data as { totalAdmins?: number; totalUsers?: number } | undefined;

    return apiOk(
      {
        adminExists: (stats?.totalAdmins ?? 0) > 0,
        setupAllowed: (stats?.totalAdmins ?? 0) === 0,
        userCount: stats?.totalUsers ?? 0,
      },
      200,
      { meta: { message: 'Setup status checked' } },
    );
  } catch (error) {
    console.error('Admin setup check error:', error);
    return apiErr('internal_error', 'Failed to check admin setup status', 500);
  }
}
