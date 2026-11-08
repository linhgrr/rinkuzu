import { withAuth } from '@/lib/api/auth';
import { getBookmarkService } from '@/lib/bookmark-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const bookmarkService = getBookmarkService();

// GET - The current user's bookmarks grouped by quiz, most bookmarks first (max 100 quizzes)
export const GET = withAuth(async (_request, { userId }) => {
  try {
    return apiOk(await bookmarkService.getBookmarkQuizzesByUser(userId));
  } catch (error) {
    logger.error({ error }, 'Error fetching bookmarked quizzes');
    return apiErr('internal_error', 'Failed to fetch bookmarked quizzes', 500);
  }
});
