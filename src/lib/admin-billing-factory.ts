import { AdminBillingRepository } from '@/repositories/AdminBillingRepository';
import { AdminBillingService } from '@/services/admin/AdminBillingService';

let adminBillingService: AdminBillingService | undefined;

export function getAdminBillingService(): AdminBillingService {
  adminBillingService ??= new AdminBillingService(new AdminBillingRepository());
  return adminBillingService;
}
