import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
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
    const parsed = readAndValidateRouteParams(params, premiumSessionIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const input = await readAndValidateJson(request, premiumSessionProgressRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }
    const result = await getPremiumQuizService().saveProgress(
      userId,
      parsed.data.sessionId,
      input.data.questionIndex,
      input.data.answer,
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
