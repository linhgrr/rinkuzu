import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { ActivationSegmentStatsRepository } from '@/repositories/ActivationSegmentStatsRepository';
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
import { AdminReportModerationService } from '@/services/admin/AdminReportModerationService';
import { QuizIndexHoldRepository } from '@/repositories/QuizIndexHoldRepository';
import { getAdminQuizService } from '@/lib/admin-quiz-factory';
import { ReviewEmailStatsService } from '@/services/admin/ReviewEmailStatsService';
import { ReviewEmailStatsRepository } from '@/repositories/ReviewEmailStatsRepository';
import { reviewReminderQaRecipients } from '@/lib/communication/review-reminder-policy';

let adminReportModerationService: AdminReportModerationService | undefined;

export function getAdminReportModerationService(): AdminReportModerationService {
  adminReportModerationService ??= new AdminReportModerationService({
    reports: new ReportRepository(),
    indexHold: new QuizIndexHoldRepository(),
    quizVisibility: getAdminQuizService(),
  });
  return adminReportModerationService;
}

let adminService: AdminService | undefined;

export function getAdminService(): AdminService {
  adminService ??= new AdminService(
    new UserRepository(),
    new ReportRepository(),
    new QuizRepository(),
    new AttemptRepository(),
    new AdminStatsRepository(),
    getAdminReportModerationService(),
  );
  return adminService;
}

let activationStatsService: ActivationStatsService | undefined;

export function getActivationStatsService(): ActivationStatsService {
  activationStatsService ??= new ActivationStatsService({
    stats: new AdminStatsRepository(),
    segments: new ActivationSegmentStatsRepository(),
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
