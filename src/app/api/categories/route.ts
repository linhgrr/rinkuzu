import { NextRequest, NextResponse } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

// GET /api/categories - Get all active categories
export async function GET(_request: NextRequest) {
  try {
    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.getCategories();

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: unknown) {
    console.error('Get categories error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
