import { getAdminAuditRepository } from '@/lib/admin-audit-factory';
import { quizIndexNowNotifier } from '@/lib/indexnow-factory';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { QuizAdminService } from '@/services/quiz/QuizAdminService';
import { QuizPersonalDataFlagService } from '@/services/quiz/QuizPersonalDataFlagService';

let adminQuizService: QuizAdminService | undefined;

export function getAdminQuizService(): QuizAdminService {
  adminQuizService ??= new QuizAdminService(new QuizRepository(), {
    premiumRepository: new PremiumQuizRepository(),
    auditRepository: getAdminAuditRepository(),
    quizIndexNow: quizIndexNowNotifier,
  });
  return adminQuizService;
}

let personalDataFlagService: QuizPersonalDataFlagService | undefined;

/** Admin Clear flag for the personal-data check (RIN-1342). */
export function getQuizPersonalDataFlagService(): QuizPersonalDataFlagService {
  personalDataFlagService ??= new QuizPersonalDataFlagService(
    new QuizRepository(),
    getAdminAuditRepository(),
    undefined,
    quizIndexNowNotifier,
  );
  return personalDataFlagService;
}
