import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { createPremiumSubmissionRequestSchema } from '@/dtos/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId }) => {
  try {
    const input = await parseJsonBody(request, createPremiumSubmissionRequestSchema);
    if (!input.ok) return input.response;
    const submission = await getPremiumQuizService().createSubmission(userId, input.data);
    return apiOk(submission, 201, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Create Premium quiz submission failed');
    return premiumQuizErrorResponse(error);
  }
});
