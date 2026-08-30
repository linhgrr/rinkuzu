import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getBookmarkService } from '@/lib/bookmark-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { bookmarkIdRouteParamsSchema } from '@/dtos/bookmark';
import { parseRouteParams } from '@/lib/api/validated';

const bookmarkService = getBookmarkService();

// DELETE - Remove bookmark
export const DELETE = withAuth(async (_request: NextRequest, { params, userId }) => {
  try {
    const parsedParams = parseRouteParams(params, bookmarkIdRouteParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const result = await bookmarkService.deleteBookmarkByUser(parsedParams.data.id, userId);

    return apiOk(result, 200, { meta: { message: 'Bookmark removed' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Error removing bookmark');

    if (error instanceof Error && error.message === 'Bookmark not found or unauthorized') {
      return apiErr('not_found', error.message, 404);
    }

    return apiErr('internal_error', 'Failed to remove bookmark', 500);
  }
});
