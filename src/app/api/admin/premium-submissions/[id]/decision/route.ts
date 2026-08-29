import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  decidePremiumSubmissionRequestSchema,
  premiumSubmissionIdParamsSchema,
} from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAdmin<{ id: string }>(async (request, { params, userId }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: premiumSubmissionIdParamsSchema,
      body: decidePremiumSubmissionRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().decide(userId, parsed.params.id, parsed.body);
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Decide Premium quiz submission failed');
    return premiumQuizErrorResponse(error);
  }
});
