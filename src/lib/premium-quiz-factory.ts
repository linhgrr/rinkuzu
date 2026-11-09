import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { PremiumQuizService } from '@/services/premium/PremiumQuizService';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

let premiumQuizService: PremiumQuizService | undefined;

export function getPremiumQuizService(): PremiumQuizService {
  if (!premiumQuizService) {
    const premiumRepository = new PremiumQuizRepository();
    premiumQuizService = new PremiumQuizService(
      new QuizRepository(),
      premiumRepository,
      new QuizAttemptProgressRepository(),
      premiumRepository,
    );
  }
  return premiumQuizService;
}
