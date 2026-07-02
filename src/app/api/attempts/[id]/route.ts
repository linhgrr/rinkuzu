import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { attemptDetailQuerySchema } from '@/dtos/user';
import { readAndValidateSearchParams } from '@/lib/api/request';

// This route accepts BOTH authenticated users (via session) and anonymous
// users that pass `userEmail` as a query param to inspect their own attempt.
export const GET = withOptionalAuth<{ id: string }>(
  async (request: NextRequest, { params, email }) => {
    try {
      const { id } = params;
      const query = readAndValidateSearchParams(request, attemptDetailQuerySchema);
      if (!query.success) {
        return apiErr('validation_error', query.error, 400, { fields: query.fields });
      }
      const userEmailParam = query.data.userEmail;

      // Check if user is authenticated or has userEmail
      if (!email && !userEmailParam) {
        return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
      }

      const userService = serviceFactory.getUserService();

      // Use session email if available, otherwise use userEmail from params
      const resolvedEmail = email ?? userEmailParam;
      if (!resolvedEmail) {
        return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
      }
      const result = await userService.getAttemptDetails(id, resolvedEmail);

      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      logger.error({ error }, 'Get attempt details error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
