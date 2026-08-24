import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { createPremiumSubmissionRequestSchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId }) => {
  try {
    const input = await readAndValidateJson(request, createPremiumSubmissionRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }
    const submission = await getPremiumQuizService().createSubmission(userId, input.data);
    return apiOk(submission, 201, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Create Premium quiz submission failed');
    return premiumQuizErrorResponse(error);
  }
});
