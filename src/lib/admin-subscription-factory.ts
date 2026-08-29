import { AdminSubscriptionRepository } from '@/repositories/AdminSubscriptionRepository';
import { AdminSubscriptionService } from '@/services/admin/AdminSubscriptionService';

let adminSubscriptionService: AdminSubscriptionService | undefined;

export function getAdminSubscriptionService(): AdminSubscriptionService {
  adminSubscriptionService ??= new AdminSubscriptionService(new AdminSubscriptionRepository());
  return adminSubscriptionService;
}
