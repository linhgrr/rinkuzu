import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getUserService } from '@/lib/user-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { userAttemptListQuerySchema } from '@/dtos/user';
import { parseSearchParams } from '@/lib/api/validated';

const userService = getUserService();

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const query = parseSearchParams(request, userAttemptListQuerySchema);
    if (!query.ok) return query.response;

    const result = await userService.getUserAttempts(userId, query.data);

    return apiOk({
      attempts: result.attempts,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Get user attempts error');
    const message = error instanceof Error ? error.message : '';

    if (message === 'User not found') {
      return apiErr('not_found', message, 404);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
});
