import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  premiumSessionIdParamsSchema,
  premiumSessionSubmitRequestSchema,
} from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: premiumSessionIdParamsSchema,
      body: premiumSessionSubmitRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().submitSession(
      userId,
      parsed.params.sessionId,
      parsed.body.idempotencyKey,
    );
    return apiOk({ ...result, idempotencyKey: parsed.body.idempotencyKey }, 200, {
      headers: PREMIUM_PRIVATE_HEADERS,
    });
  } catch (error) {
    logger.error({ error }, 'Submit Premium quiz session failed');
    return premiumQuizErrorResponse(error);
  }
});
