import type { SubscriptionRecord } from '@/entities/Subscription';
import { serializeId } from '@/lib/mongo-id';
import type {
  SubscriptionPersistenceRecord,
  SubscriptionUserPersistenceRecord,
} from '@/repositories/types/SubscriptionPersistence';

function isPopulatedUser(
  user: SubscriptionPersistenceRecord['user'],
): user is SubscriptionUserPersistenceRecord {
  return typeof user === 'object' && user !== null && '_id' in user;
}

function requireDate(value: Date | undefined, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  throw new TypeError(`${field} must be a valid date`);
}

export class SubscriptionPersistenceMapper {
  static toEntity(record: SubscriptionPersistenceRecord): SubscriptionRecord {
    const base = {
      id: serializeId(record._id, 'subscription._id'),
      userId: serializeId(
        isPopulatedUser(record.user) ? record.user._id : record.user,
        'subscription.user',
      ),
      userEmail: record.userEmail,
      type: record.type,
      amount: record.amount,
      currency: record.currency,
      payosOrderId: record.payosOrderId,
      payosTransactionId: record.payosTransactionId,
      payosPaymentUrl: record.payosPaymentUrl,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    if (record.status === 'completed') {
      return {
        ...base,
        status: record.status,
        startDate: requireDate(record.startDate, 'subscription.startDate'),
        endDate: record.endDate,
      };
    }

    if (record.status === 'expired') {
      return {
        ...base,
        status: record.status,
        startDate: requireDate(record.startDate, 'subscription.startDate'),
        endDate: requireDate(record.endDate, 'subscription.endDate'),
      };
    }

    return {
      ...base,
      status: record.status,
      startDate: record.startDate,
      endDate: record.endDate,
    };
  }
}
