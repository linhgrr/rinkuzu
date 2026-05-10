import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

// GET /api/admin/categories - Get all categories (for admin)
export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const searchOptions = {
      search: searchParams.get('search'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getCategories(searchOptions);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// POST /api/admin/categories - Create new category
export const POST = withAdmin(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const adminService = serviceFactory.getAdminService();

    const result = await adminService.createCategory(body, context.userId);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Create category error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
