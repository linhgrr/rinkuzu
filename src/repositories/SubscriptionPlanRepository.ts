import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import type { BillingPlan } from '@/entities/AdminBilling';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import { findBillingPlanById } from '@/repositories/helpers/findBillingPlanById';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';
import type { BillingPlanPersistenceRecord } from '@/repositories/types/AdminBillingPersistence';
import { SubscriptionDurationType } from '@/types/subscription';

const SUPPORTED_PLAN_DURATIONS = Object.values(SubscriptionDurationType);

export class SubscriptionPlanRepository implements ISubscriptionPlanRepository {
  async findById(planId: string): Promise<BillingPlan | null> {
    return findBillingPlanById(planId);
  }

  async findActiveById(planId: string): Promise<BillingPlan | null> {
    await connectDB();
    const plan = await Plan.findOne({
      _id: planId,
      isActive: true,
      duration: { $in: SUPPORTED_PLAN_DURATIONS },
    }).lean<BillingPlanPersistenceRecord>();
    return plan ? AdminBillingPersistenceMapper.toPlan(plan) : null;
  }

  async listActive(): Promise<BillingPlan[]> {
    await connectDB();
    const plans = await Plan.find({
      isActive: true,
      duration: { $in: SUPPORTED_PLAN_DURATIONS },
    }).lean<BillingPlanPersistenceRecord[]>();
    return plans.map((plan) => AdminBillingPersistenceMapper.toPlan(plan));
  }
}
