import type { AdminSubscriptionRecord, BillingPlan } from '@/entities/AdminBilling';
import { serializeId } from '@/lib/mongo-id';
import type {
  AdminSubscriptionPersistenceRecord,
  BillingPlanPersistenceRecord,
} from '@/repositories/types/AdminBillingPersistence';

export class AdminBillingPersistenceMapper {
  static toPlan(record: BillingPlanPersistenceRecord): BillingPlan {
    return {
      id: serializeId(record._id, 'plan._id'),
      name: record.name,
      price: record.price,
      duration: record.duration,
      features: record.features,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toSubscription(record: AdminSubscriptionPersistenceRecord): AdminSubscriptionRecord {
    return {
      id: serializeId(record._id, 'subscription._id'),
      user: serializeId(record.user, 'subscription.user'),
      userEmail: record.userEmail,
      type: record.type,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      payosOrderId: record.payosOrderId,
      payosTransactionId: record.payosTransactionId,
      payosPaymentUrl: record.payosPaymentUrl,
      startDate: record.startDate,
      endDate: record.endDate,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
