import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { bookmarkIdRouteParamsSchema } from '@/dtos/bookmark';

const bookmarkService = serviceFactory.getBookmarkService();

// DELETE - Remove bookmark
export const DELETE = withAuth(async (_request: NextRequest, { params, email }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, bookmarkIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    if (!email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    await bookmarkService.deleteBookmarkByUser(parsedParams.data.id, email);

    return apiOk(null, 200, { meta: { message: 'Bookmark removed' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Error removing bookmark');

    if (error instanceof Error && error.message === 'Bookmark not found or unauthorized') {
      return apiErr('not_found', error.message, 404);
    }

    return apiErr('internal_error', 'Failed to remove bookmark', 500);
  }
});
