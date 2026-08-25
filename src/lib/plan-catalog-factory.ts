import { SubscriptionPlanRepository } from '@/repositories/SubscriptionPlanRepository';
import { PlanCatalogService } from '@/services/billing/PlanCatalogService';

export function createPlanCatalogService(): PlanCatalogService {
  return new PlanCatalogService(new SubscriptionPlanRepository());
}
