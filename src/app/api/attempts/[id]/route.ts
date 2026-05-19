import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

// This route accepts BOTH authenticated users (via session) and anonymous
// users that pass `userEmail` as a query param to inspect their own attempt.
export const GET = withOptionalAuth<{ id: string }>(
  async (request: NextRequest, { params, email }) => {
    try {
      const { id } = params;
      const { searchParams } = new URL(request.url);
      const userEmailParam = searchParams.get('userEmail');

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
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      console.error('Get attempt details error:', error);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
