import {
  premiumSessionBatchRequestSchema,
  premiumSessionIdParamsSchema,
} from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { withAuth } from '@/lib/api/auth';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { logger } from '@/lib/logger';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumSessionIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const input = await readAndValidateJson(request, premiumSessionBatchRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }
    const result = await getPremiumQuizService().revealFlashcard(
      userId,
      parsed.data.sessionId,
      input.data.cursor,
    );
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Reveal Premium flashcard failed');
    return premiumQuizErrorResponse(error);
  }
});
