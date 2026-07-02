import { QuizRepository } from '@/repositories/QuizRepository';
import { QuizAdminService } from '@/services/quiz/QuizAdminService';

let adminQuizService: QuizAdminService | undefined;

export function getAdminQuizService(): QuizAdminService {
  adminQuizService ??= new QuizAdminService(new QuizRepository());
  return adminQuizService;
}
