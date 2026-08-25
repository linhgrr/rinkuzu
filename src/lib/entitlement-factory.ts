import { EntitlementRepository } from '@/repositories/EntitlementRepository';
import { EntitlementService } from '@/services/entitlement/EntitlementService';

export function createEntitlementService(): EntitlementService {
  return new EntitlementService(new EntitlementRepository());
}
