import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { bookmarkListQuerySchema, createBookmarkRequestSchema } from '@/dtos/bookmark';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';

const bookmarkService = serviceFactory.getBookmarkService();

// GET - Get all bookmarks for current user
export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const query = readAndValidateSearchParams(request, bookmarkListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const result = await bookmarkService.getBookmarksByUser(userId, query.data);

    return apiOk({
      bookmarks: result.bookmarks,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching bookmarks');
    return apiErr('internal_error', 'Failed to fetch bookmarks', 500);
  }
});

// POST - Create new bookmark
export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    const input = await readAndValidateJson(request, createBookmarkRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const bookmark = await bookmarkService.createBookmark({ userId, userEmail: email }, input.data);

    return apiOk(bookmark);
  } catch (error: unknown) {
    logger.error({ error }, 'Error creating bookmark');
    const message = error instanceof Error ? error.message : '';

    if (message === 'Question already bookmarked') {
      return apiErr('validation_error', message, 400);
    }

    return apiErr('internal_error', 'Failed to create bookmark', 500);
  }
});
