import { premiumSubmissionIdParamsSchema } from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { withAdmin } from '@/lib/api/auth';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { logger } from '@/lib/logger';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumSubmissionIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const result = await getPremiumQuizService().getAdminSourceUrl(parsed.data.id);
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Get Premium source PDF failed');
    return premiumQuizErrorResponse(error);
  }
});
