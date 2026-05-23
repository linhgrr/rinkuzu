import { NextRequest } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

// GET /api/categories/[slug] - Get category by slug with quizzes
export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    if (!slug) {
      return apiErr('validation_error', 'Slug is required', 400);
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || undefined;

    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.getCategoryBySlug(slug, page, limit, search);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get category by slug error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
