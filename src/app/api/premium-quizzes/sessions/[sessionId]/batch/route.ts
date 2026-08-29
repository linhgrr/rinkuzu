import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  premiumSessionBatchRequestSchema,
  premiumSessionIdParamsSchema,
} from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ sessionId: string }>(
  async (request, { params, userId, session }) => {
    try {
      const parsed = await parseParamsAndBody(request, params, {
        params: premiumSessionIdParamsSchema,
        body: premiumSessionBatchRequestSchema,
      });
      if (!parsed.ok) return parsed.response;
      const result = await getPremiumQuizService().getBatch(
        { userId, role: session.user.role },
        parsed.params.sessionId,
        parsed.body.cursor,
      );
      return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
    } catch (error) {
      logger.error({ error }, 'Get Premium quiz batch failed');
      return premiumQuizErrorResponse(error);
    }
  },
);
