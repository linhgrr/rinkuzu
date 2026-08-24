import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
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
      const parsed = readAndValidateRouteParams(params, premiumSessionIdParamsSchema);
      if (!parsed.success) {
        return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
      }
      const input = await readAndValidateJson(request, premiumSessionBatchRequestSchema);
      if (!input.success) {
        return apiErr('validation_error', input.error, 400, { fields: input.fields });
      }
      const result = await getPremiumQuizService().getBatch(
        { userId, role: session.user.role },
        parsed.data.sessionId,
        input.data.cursor,
      );
      return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
    } catch (error) {
      logger.error({ error }, 'Get Premium quiz batch failed');
      return premiumQuizErrorResponse(error);
    }
  },
);
