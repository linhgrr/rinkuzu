import { withPremiumRead } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const GET = withPremiumRead('Get credit wallet failed', (userId) =>
  getPremiumQuizService().getCredits(userId),
);
