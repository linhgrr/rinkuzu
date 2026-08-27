import { AdminBillingOrdersRepository } from '@/repositories/AdminBillingOrdersRepository';
import { AdminBillingOrdersService } from '@/services/admin/AdminBillingOrdersService';

let service: AdminBillingOrdersService | undefined;

export function getAdminBillingOrdersService(): AdminBillingOrdersService {
  service ??= new AdminBillingOrdersService(new AdminBillingOrdersRepository());
  return service;
}
