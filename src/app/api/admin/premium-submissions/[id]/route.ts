import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { premiumSubmissionIdParamsSchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumSubmissionIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const submission = await getPremiumQuizService().getAdminSubmission(parsed.data.id);
    return apiOk(submission, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Get Premium quiz submission failed');
    return premiumQuizErrorResponse(error);
  }
});
