import type { SubscriptionPlanDto } from '@/dtos/subscription';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';

export class PlanCatalogService {
  constructor(private readonly repository: ISubscriptionPlanRepository) {}

  async listActive(): Promise<SubscriptionPlanDto[]> {
    return (await this.repository.listActive()).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
    }));
  }
}
