import type { NextRequest } from 'next/server';
import { adminLearnerSearchQuerySchema } from '@/dtos/admin-learner';
import { consumeAdminRateLimit } from '@/lib/admin-rate-limit';
import { getAdminUserIdentityService } from '@/lib/admin-user-identity-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { parseSearchParams } from '@/lib/api/validated';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
} as const;

// GET /api/admin/personal-learning/learners?search= - Resolve learners by name or email.
// Deliberately not audited: per RIN-400 only the per-learner drill-down view is.
export const GET = withAdmin(async (request: NextRequest, { userId }) => {
  try {
    const rateLimit = await consumeAdminRateLimit('learner_search_user', userId);
    if (!rateLimit.allowed) {
      return apiErr('rate_limit_exceeded', 'Too many requests. Try again later.', 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      });
    }

    const query = parseSearchParams(request, adminLearnerSearchQuerySchema);
    if (!query.ok) return query.response;

    const result = await getAdminUserIdentityService().searchLearners(query.data.search);
    return result.success
      ? apiOk(result.data, 200, { headers: NO_STORE_HEADERS })
      : apiServiceErr(result);
  } catch (error: unknown) {
    logger.error({ error }, 'Search learners route error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
