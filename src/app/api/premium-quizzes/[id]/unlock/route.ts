import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import { premiumQuizIdParamsSchema, unlockPremiumQuizRequestSchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request, { params, userId }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: premiumQuizIdParamsSchema,
      body: unlockPremiumQuizRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().unlock(
      userId,
      parsed.params.id,
      parsed.body.idempotencyKey,
    );
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Unlock Premium quiz failed');
    return premiumQuizErrorResponse(error);
  }
});
