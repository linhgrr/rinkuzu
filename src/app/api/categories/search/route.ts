import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// GET /api/categories/search - Search categories for quiz creation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';

    const categoryService = serviceFactory.getCategoryService();

    const result = await categoryService.searchCategories(search);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: unknown) {
    console.error('Search categories error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
