import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { premiumSubmissionListQuerySchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request) => {
  try {
    const query = parseSearchParams(request, premiumSubmissionListQuerySchema);
    if (!query.ok) return query.response;
    const result = await getPremiumQuizService().listAdmin(query.data);
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'List Premium quiz submissions failed');
    return premiumQuizErrorResponse(error);
  }
});
