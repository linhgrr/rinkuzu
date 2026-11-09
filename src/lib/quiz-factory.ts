import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DiscussionRepository } from '@/repositories/DiscussionRepository';
import { FolderRepository } from '@/repositories/FolderRepository';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { QuizService } from '@/services/quiz/QuizService';
import { QuizPageReportService } from '@/services/quiz/QuizPageReportService';
import { QuizIndexHoldRepository } from '@/repositories/QuizIndexHoldRepository';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

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
    getPremiumQuizService(),
    new AttemptRepository(),
    new PremiumQuizRepository(),
  );
  return quizService;
}

let quizPageReportService: QuizPageReportService | undefined;

export function getQuizPageReportService(): QuizPageReportService {
  quizPageReportService ??= new QuizPageReportService(
    new QuizRepository(),
    new ReportRepository(),
    new QuizIndexHoldRepository(),
  );
  return quizPageReportService;
}
