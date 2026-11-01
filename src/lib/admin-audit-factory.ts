import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';

let repository: IAdminAuditRepository | undefined;

export function getAdminAuditRepository(): IAdminAuditRepository {
  repository ??= new AdminAuditRepository();
  return repository;
}
