import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { getUserService } from '@/lib/user-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { attemptDetailQuerySchema, attemptIdRouteParamsSchema } from '@/dtos/user';
import { parseRouteParams, parseSearchParams } from '@/lib/api/validated';
import {
  GUEST_CLAIM_TOKEN_HEADER,
  guestClaimTokenSchema,
} from '@/lib/validation/guest-claim-token';
import type { AttemptOwner } from '@/interfaces/services/IUserService';

// This route accepts authenticated users (via session) and anonymous users that
// send their claim token in the `x-guest-claim-token` header (RIN-912) or, for
// legacy guest-email attempts, `userEmail` as a query param.
export const GET = withOptionalAuth(async (request: NextRequest, { params, userId, session }) => {
  try {
    const parsedParams = parseRouteParams(params, attemptIdRouteParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const query = parseSearchParams(request, attemptDetailQuerySchema);
    if (!query.ok) return query.response;
    const userEmailParam = query.data.userEmail;
    const claimTokenHeader = request.headers.get(GUEST_CLAIM_TOKEN_HEADER);
    const claimToken = guestClaimTokenSchema.safeParse(claimTokenHeader);
    if (!userId && claimTokenHeader !== null && !claimToken.success) {
      return apiErr('validation_error', 'Guest claim token is invalid', 400);
    }

    const owner: AttemptOwner | null = userId
      ? { userId, ...(session?.user?.role === 'admin' ? { role: 'admin' } : {}) }
      : claimToken.success
        ? { guestClaimToken: claimToken.data }
        : userEmailParam
          ? { guestEmail: userEmailParam }
          : null;
    if (!owner) {
      return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
    }

    const userService = getUserService();
    const result = await userService.getAttemptDetails(
      parsedParams.data.id,
      owner,
      query.data.locale === undefined ? {} : { locale: query.data.locale },
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get attempt details error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
