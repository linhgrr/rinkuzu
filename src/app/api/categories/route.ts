import { NextRequest } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

// GET /api/categories - Get all active categories
export async function GET(_request: NextRequest) {
  try {
    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.getCategories();

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get categories error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
