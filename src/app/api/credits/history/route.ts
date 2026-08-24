import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { userId }) => {
  try {
    const result = await getPremiumQuizService().getCredits(userId);
    return apiOk(result.entries, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Get credit history failed');
    return premiumQuizErrorResponse(error);
  }
});
