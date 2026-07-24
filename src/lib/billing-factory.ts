import { BillingRepository } from '@/repositories/BillingRepository';
import { BillingService } from '@/services/billing/BillingService';

export function createBillingService(): BillingService {
  return new BillingService(new BillingRepository());
}
