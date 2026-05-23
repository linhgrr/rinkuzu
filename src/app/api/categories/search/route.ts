import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/categories/search - Search categories for quiz creation
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';

    const categoryService = serviceFactory.getCategoryService();
    const result = await categoryService.searchCategories(search);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Search categories error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
