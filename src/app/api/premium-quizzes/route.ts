import { premiumCatalogListQuerySchema } from '@/dtos/premium-quiz';
import { withOptionalAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** Public catalog; a signed-in learner also gets `unlocked` per card (RIN-1014). */
export const GET = withOptionalAuth(async (request, { userId }) => {
  const query = parseSearchParams(request, premiumCatalogListQuerySchema);
  if (!query.ok) return query.response;
  const result = await getPremiumQuizService().listCatalog(query.data, userId);
  return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
});
