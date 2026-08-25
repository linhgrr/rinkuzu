import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import { EntitlementAdminService } from '@/services/entitlement/EntitlementAdminService';

export function createEntitlementAdminService(): EntitlementAdminService {
  return new EntitlementAdminService(new EntitlementLedgerRepository());
}
