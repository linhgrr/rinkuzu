import { premiumQuizIdParamsSchema } from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { withAuth } from '@/lib/api/auth';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { logger } from '@/lib/logger';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (_request, { params, userId, session }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumQuizIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const result = await getPremiumQuizService().startFlashcardSession(
      { userId, role: session.user.role },
      parsed.data.id,
    );
    return apiOk(result, 201, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Start Premium flashcard session failed');
    return premiumQuizErrorResponse(error);
  }
});
