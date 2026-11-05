import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { UserService } from '@/services/user/UserService';
import { NextQuizResolver } from '@/services/quiz/next-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

let userService: UserService | undefined;

export function getUserService(): UserService {
  if (!userService) {
    const attemptRepository = new AttemptRepository();
    userService = new UserService(
      new UserRepository(),
      attemptRepository,
      new QuizRepository(),
      getPremiumQuizService(),
      new NextQuizResolver(new DashboardRepository(), attemptRepository),
    );
  }
  return userService;
}
