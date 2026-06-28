import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getQuizLibraryForUser } from '@/lib/quiz/library-server';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const url = new URL(request.url);
    const folderParam = url.searchParams.get('folder');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 100));
    return apiOk(await getQuizLibraryForUser({ userId, folder: folderParam, page, limit }));
  } catch (error) {
    logger.error({ error }, 'Get quiz library error');
    return apiErr('internal_error', 'Failed to get quiz library', 500);
  }
});
