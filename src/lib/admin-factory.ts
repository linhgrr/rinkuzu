import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { ReportRepository } from '@/repositories/ReportRepository';
import { UserRepository } from '@/repositories/UserRepository';
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
