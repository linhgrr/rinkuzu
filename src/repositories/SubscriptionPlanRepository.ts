import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import type { BillingPlan } from '@/entities/AdminBilling';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';
import type { BillingPlanPersistenceRecord } from '@/repositories/types/AdminBillingPersistence';

export class SubscriptionPlanRepository implements ISubscriptionPlanRepository {
  async findById(planId: string): Promise<BillingPlan | null> {
    await connectDB();
    const plan = await Plan.findById(planId).lean<BillingPlanPersistenceRecord>();
    return plan ? AdminBillingPersistenceMapper.toPlan(plan) : null;
  }

  async findActiveById(planId: string): Promise<BillingPlan | null> {
    await connectDB();
    const plan = await Plan.findOne({
      _id: planId,
      isActive: true,
    }).lean<BillingPlanPersistenceRecord>();
    return plan ? AdminBillingPersistenceMapper.toPlan(plan) : null;
  }

  async listActive(): Promise<BillingPlan[]> {
    await connectDB();
    const plans = await Plan.find({ isActive: true }).lean<BillingPlanPersistenceRecord[]>();
    return plans.map((plan) => AdminBillingPersistenceMapper.toPlan(plan));
  }
}
