import { getAdminAuditRepository } from '@/lib/admin-audit-factory';
import { indexNowNotifier } from '@/lib/indexnow-factory';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizTopicAdminRepository } from '@/repositories/QuizTopicAdminRepository';
import { QuizTopicAdminService } from '@/services/admin/QuizTopicAdminService';

let quizTopicAdminService: QuizTopicAdminService | undefined;

export function getQuizTopicAdminService(): QuizTopicAdminService {
  quizTopicAdminService ??= new QuizTopicAdminService({
    topicRepository: new QuizTopicAdminRepository(),
    quizRepository: new DashboardRepository(),
    auditRepository: getAdminAuditRepository(),
    indexNow: indexNowNotifier,
  });
  return quizTopicAdminService;
}
