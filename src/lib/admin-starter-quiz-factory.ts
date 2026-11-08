import { getAdminAuditRepository } from '@/lib/admin-audit-factory';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { StarterQuizAdminRepository } from '@/repositories/StarterQuizAdminRepository';
import { StarterQuizAdminService } from '@/services/admin/StarterQuizAdminService';

let starterQuizAdminService: StarterQuizAdminService | undefined;

export function getStarterQuizAdminService(): StarterQuizAdminService {
  starterQuizAdminService ??= new StarterQuizAdminService({
    starterRepository: new StarterQuizAdminRepository(),
    candidateRepository: new DashboardRepository(),
    auditRepository: getAdminAuditRepository(),
  });
  return starterQuizAdminService;
}
