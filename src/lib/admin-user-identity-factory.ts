import { UserIdentityRepository } from '@/repositories/UserIdentityRepository';
import { AdminUserIdentityService } from '@/services/admin/AdminUserIdentityService';

let adminUserIdentityService: AdminUserIdentityService | undefined;

export function getAdminUserIdentityService(): AdminUserIdentityService {
  adminUserIdentityService ??= new AdminUserIdentityService(new UserIdentityRepository());
  return adminUserIdentityService;
}
