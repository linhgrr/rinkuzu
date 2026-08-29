import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  premiumSessionIdParamsSchema,
  premiumSessionProgressRequestSchema,
} from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const PUT = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: premiumSessionIdParamsSchema,
      body: premiumSessionProgressRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().saveProgress(
      userId,
      parsed.params.sessionId,
      parsed.body.questionIndex,
      parsed.body.answer,
    );
    return apiOk(
      {
        saved: true,
        currentQuestionIndex: result.currentQuestionIndex,
        idleExpiresAt: result.idleExpiresAt.toISOString(),
      },
      200,
      { headers: PREMIUM_PRIVATE_HEADERS },
    );
  } catch (error) {
    logger.error({ error }, 'Save Premium quiz progress failed');
    return premiumQuizErrorResponse(error);
  }
});
