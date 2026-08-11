import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { FolderRepository } from '@/repositories/FolderRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { QuizService } from '@/services/quiz/QuizService';

let quizService: QuizService | undefined;

export function getQuizService(): QuizService {
  quizService ??= new QuizService(
    new QuizRepository(),
    new UserRepository(),
    new DiscussionRepository(),
    new ReportRepository(),
    new QuizProgressRepository(),
    new QuizAttemptProgressRepository(),
    new FolderRepository(),
  );
  return quizService;
}
