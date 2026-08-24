import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { UserService } from '@/services/user/UserService';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

let userService: UserService | undefined;

export function getUserService(): UserService {
  userService ??= new UserService(
    new UserRepository(),
    new AttemptRepository(),
    new QuizRepository(),
    getPremiumQuizService(),
  );
  return userService;
}
