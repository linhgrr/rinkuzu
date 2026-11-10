import type { IPremiumDecisionNotifier } from '@/interfaces/services/IPremiumDecisionNotifier';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { PremiumQuizService } from '@/services/premium/PremiumQuizService';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

let premiumQuizService: PremiumQuizService | undefined;

/**
 * Loaded on the first reject only, so the quiz pages that build this service
 * do not pull the email templates and the outbox into their bundle (RIN-1348).
 */
const rejectMailNotifier: IPremiumDecisionNotifier = {
  async queueRejectEmail(notice) {
    const { PremiumRejectMailNotifier } = await import('@/lib/communication/premium-reject');
    await new PremiumRejectMailNotifier().queueRejectEmail(notice);
  },
};

export function getPremiumQuizService(): PremiumQuizService {
  if (!premiumQuizService) {
    const premiumRepository = new PremiumQuizRepository();
    premiumQuizService = new PremiumQuizService(
      new QuizRepository(),
      premiumRepository,
      new QuizAttemptProgressRepository(),
      premiumRepository,
      rejectMailNotifier,
    );
  }
  return premiumQuizService;
}
