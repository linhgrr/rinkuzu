import { withPremiumRead } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

/** The wallet's movements rather than its balance; the same read, projected. */
export const GET = withPremiumRead('Get credit history failed', async (userId) => {
  const wallet = await getPremiumQuizService().getCredits(userId);
  return wallet.entries;
});
