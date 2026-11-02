import { z } from 'zod';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { sanitizedGetRequest } from '@/lib/adaptive/sanitized-request';
import { withAdmin } from '@/lib/api/auth';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

// Mirrors the windows the adaptive API's GET /api/admin/personal-learning/summary accepts.
const querySchema = z
  .object({
    window: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  })
  .strict();

/**
 * Aggregate-only personal-learning statistics. The upstream body carries no
 * per-learner identifiers, so no learner view is audited here.
 */
export const GET = withAdmin(async (req, { userId, session }) => {
  const query = parseSearchParams(req, querySchema);
  if (!query.ok) return query.response;

  const response = await proxyAdaptiveRequest(
    sanitizedGetRequest(req, query.data),
    '/admin/personal-learning/summary',
    { userId, userRole: session.user.role },
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
});
