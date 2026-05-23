import { NextRequest } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

// GET /api/categories/stats - Get category statistics for public display
export async function GET(_request: NextRequest) {
  try {
    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.getCategoryStats();

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    // Transform the data to match expected format
    const categoriesWithStats = result.data;
    if (!categoriesWithStats) {
      return apiErr('not_found', 'No category data found', 404);
    }

    const hotCategories = categoriesWithStats.slice(0, 3);

    return apiOk({
      hotCategories,
      allCategories: categoriesWithStats,
      totalCategories: categoriesWithStats.length,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Get category stats error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
