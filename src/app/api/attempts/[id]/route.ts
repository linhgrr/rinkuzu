import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { getUserService } from '@/lib/user-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { attemptDetailQuerySchema, attemptIdRouteParamsSchema } from '@/dtos/user';
import { readAndValidateRouteParams, readAndValidateSearchParams } from '@/lib/api/request';

// This route accepts BOTH authenticated users (via session) and anonymous
// users that pass `userEmail` as a query param to inspect their own attempt.
export const GET = withOptionalAuth(async (request: NextRequest, { params, userId, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, attemptIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const query = readAndValidateSearchParams(request, attemptDetailQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }
    const userEmailParam = query.data.userEmail;

    const owner = userId
      ? { userId, ...(session?.user?.role === 'admin' ? { role: 'admin' } : {}) }
      : userEmailParam
        ? { guestEmail: userEmailParam }
        : null;
    if (!owner) {
      return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
    }

    const userService = getUserService();
    const result = await userService.getAttemptDetails(parsedParams.data.id, owner);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get attempt details error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
