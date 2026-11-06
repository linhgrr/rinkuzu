import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { ActivationEmailStatsRepository } from '@/repositories/ActivationEmailStatsRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { fetchAdaptiveActivationEvents } from '@/lib/adaptive/activation-events';
import { UserTestAccountRepository } from '@/repositories/UserTestAccountRepository';
import { AdminTestAccountService } from '@/services/admin/AdminTestAccountService';
import { ActivationStatsService } from '@/services/admin/ActivationStatsService';
import { AdminService } from '@/services/admin/AdminService';
import { ReviewEmailStatsService } from '@/services/admin/ReviewEmailStatsService';
import { ReviewEmailStatsRepository } from '@/repositories/ReviewEmailStatsRepository';
import { reviewReminderQaRecipients } from '@/lib/communication/review-reminder-policy';

let adminService: AdminService | undefined;

export function getAdminService(): AdminService {
  adminService ??= new AdminService(
    new UserRepository(),
    new ReportRepository(),
    new QuizRepository(),
    new AttemptRepository(),
    new AdminStatsRepository(),
  );
  return adminService;
}

let activationStatsService: ActivationStatsService | undefined;

export function getActivationStatsService(): ActivationStatsService {
  activationStatsService ??= new ActivationStatsService({
    stats: new AdminStatsRepository(),
    activationEmail: new ActivationEmailStatsRepository(),
    audit: new AdminAuditRepository(),
    adaptiveEvents: fetchAdaptiveActivationEvents,
  });
  return activationStatsService;
}

let testAccountService: AdminTestAccountService | undefined;

export function getAdminTestAccountService(): AdminTestAccountService {
  testAccountService ??= new AdminTestAccountService({
    users: new UserTestAccountRepository(),
    audit: new AdminAuditRepository(),
  });
  return testAccountService;
}

let reviewEmailStatsService: ReviewEmailStatsService | undefined;

export function getReviewEmailStatsService(): ReviewEmailStatsService {
  reviewEmailStatsService ??= new ReviewEmailStatsService({
    stats: new ReviewEmailStatsRepository(),
    qaEmails: () => [...reviewReminderQaRecipients()],
  });
  return reviewEmailStatsService;
}
