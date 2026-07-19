import type { BillingPlan } from '@/entities/AdminBilling';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';
import type { BillingPlanPersistenceRecord } from '@/repositories/types/AdminBillingPersistence';

export async function findBillingPlanById(planId: string): Promise<BillingPlan | null> {
  await connectDB();
  const plan = await Plan.findById(planId).lean<BillingPlanPersistenceRecord>();
  return plan ? AdminBillingPersistenceMapper.toPlan(plan) : null;
}
