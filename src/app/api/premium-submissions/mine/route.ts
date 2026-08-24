import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { premiumSubmissionListQuerySchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { userId }) => {
  try {
    const query = readAndValidateSearchParams(request, premiumSubmissionListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }
    const result = await getPremiumQuizService().listMine(userId, query.data);
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'List own Premium quiz submissions failed');
    return premiumQuizErrorResponse(error);
  }
});
