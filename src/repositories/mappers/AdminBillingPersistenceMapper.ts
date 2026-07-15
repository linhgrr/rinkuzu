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
      ...(record.payosTransactionId !== undefined && {
        payosTransactionId: record.payosTransactionId,
      }),
      ...(record.payosPaymentUrl !== undefined && {
        payosPaymentUrl: record.payosPaymentUrl,
      }),
      ...(record.startDate !== undefined && { startDate: record.startDate }),
      ...(record.endDate !== undefined && { endDate: record.endDate }),
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
