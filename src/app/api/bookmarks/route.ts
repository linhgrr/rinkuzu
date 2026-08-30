import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getBookmarkService } from '@/lib/bookmark-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { bookmarkListQuerySchema, createBookmarkRequestSchema } from '@/dtos/bookmark';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

const bookmarkService = getBookmarkService();

// GET - Get all bookmarks for current user
export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const query = parseSearchParams(request, bookmarkListQuerySchema);
    if (!query.ok) return query.response;

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
    const input = await parseJsonBody(request, createBookmarkRequestSchema);
    if (!input.ok) return input.response;

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
