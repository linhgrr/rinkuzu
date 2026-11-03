import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { fetchAdaptiveActivationEvents } from '@/lib/adaptive/activation-events';
import { ActivationStatsService } from '@/services/admin/ActivationStatsService';
import { AdminService } from '@/services/admin/AdminService';

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
    audit: new AdminAuditRepository(),
    adaptiveEvents: fetchAdaptiveActivationEvents,
  });
  return activationStatsService;
}
