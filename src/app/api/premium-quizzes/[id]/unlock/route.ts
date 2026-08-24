import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { premiumQuizIdParamsSchema, unlockPremiumQuizRequestSchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request, { params, userId }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumQuizIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const input = await readAndValidateJson(request, unlockPremiumQuizRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }
    const result = await getPremiumQuizService().unlock(
      userId,
      parsed.data.id,
      input.data.idempotencyKey,
    );
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Unlock Premium quiz failed');
    return premiumQuizErrorResponse(error);
  }
});
