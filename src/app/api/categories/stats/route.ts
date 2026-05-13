import { NextRequest, NextResponse } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

// GET /api/categories/stats - Get category statistics for public display
export async function GET(_request: NextRequest) {
  try {
    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.getCategoryStats();

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    // Transform the data to match expected format
    const categoriesWithStats = result.data;
    if (!categoriesWithStats) {
      return apiErr('not_found', 'No category data found', 404);
    }

    const hotCategories = categoriesWithStats.slice(0, 3);

    return NextResponse.json({
      success: true,
      data: {
        hotCategories,
        allCategories: categoriesWithStats,
        totalCategories: categoriesWithStats.length,
      },
    });
  } catch (error: unknown) {
    console.error('Get category stats error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
