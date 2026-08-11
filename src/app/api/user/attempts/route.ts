import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getUserService } from '@/lib/user-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { userAttemptListQuerySchema } from '@/dtos/user';
import { readAndValidateSearchParams } from '@/lib/api/request';

const userService = getUserService();

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const query = readAndValidateSearchParams(request, userAttemptListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const result = await userService.getUserAttempts(userId, query.data);

    return apiOk({
      attempts: result.attempts,
      pagination: result.pagination,
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
