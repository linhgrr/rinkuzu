import {
  premiumSessionBatchRequestSchema,
  premiumSessionIdParamsSchema,
} from '@/dtos/premium-quiz';
import { apiOk } from '@/lib/api/response';
import { withAuth } from '@/lib/api/auth';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { parseParamsAndBody } from '@/lib/api/validated';
import { logger } from '@/lib/logger';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: premiumSessionIdParamsSchema,
      body: premiumSessionBatchRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().getFlashcard(
      userId,
      parsed.params.sessionId,
      parsed.body.cursor,
    );
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Get Premium flashcard failed');
    return premiumQuizErrorResponse(error);
  }
});
