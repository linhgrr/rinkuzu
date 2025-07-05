import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

export const dynamic = 'force-dynamic';

// POST /api/admin/setup - Create default admin account (only if no admin exists)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.initializeSystem();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Admin setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize system' },
      { status: 500 }
    );
  }
}

// GET /api/admin/setup - Check if admin setup is needed
export async function GET() {
  try {
      const adminService = serviceFactory.getAdminService();
      const result = await adminService.getStats();

    return NextResponse.json({
      success: true,
      data: {
          setupComplete: result.success,
          message: 'Setup status checked'
      }
    });

  } catch (error: any) {
    console.error('Admin setup check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check admin setup status' },
      { status: 500 }
    );
  }
} 