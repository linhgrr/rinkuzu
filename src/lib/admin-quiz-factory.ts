import { getAdminAuditRepository } from '@/lib/admin-audit-factory';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { QuizAdminService } from '@/services/quiz/QuizAdminService';

let adminQuizService: QuizAdminService | undefined;

export function getAdminQuizService(): QuizAdminService {
  adminQuizService ??= new QuizAdminService(new QuizRepository(), {
    premiumRepository: new PremiumQuizRepository(),
    auditRepository: getAdminAuditRepository(),
  });
  return adminQuizService;
}
