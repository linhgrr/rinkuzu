import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { PremiumQuizService } from '@/services/premium/PremiumQuizService';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

let premiumQuizService: PremiumQuizService | undefined;

export function getPremiumQuizService(): PremiumQuizService {
  premiumQuizService ??= new PremiumQuizService(
    new QuizRepository(),
    new PremiumQuizRepository(),
    new QuizAttemptProgressRepository(),
  );
  return premiumQuizService;
}
