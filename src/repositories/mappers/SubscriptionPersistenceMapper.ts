import type { SubscriptionRecord } from '@/entities/Subscription';
import { serializeId } from '@/lib/mongo-id';
import type { SubscriptionPersistenceRecord } from '@/repositories/types/SubscriptionPersistence';

/**
 * Shared persistence → domain shape for embedded user/account subscription snapshots.
 * Omits optional fields when undefined (exact structural match of prior dual mappers).
 */
export interface EmbeddedSubscriptionPersistenceFields {
  planId: string;
  planName: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export function mapEmbeddedSubscription(
  record: EmbeddedSubscriptionPersistenceFields,
): EmbeddedSubscriptionPersistenceFields {
  return {
    planId: record.planId,
    planName: record.planName,
    isActive: record.isActive,
    ...(record.startDate === undefined ? {} : { startDate: record.startDate }),
    ...(record.endDate === undefined ? {} : { endDate: record.endDate }),
    ...(record.payosOrderId === undefined ? {} : { payosOrderId: record.payosOrderId }),
    ...(record.payosTransactionId === undefined
      ? {}
      : { payosTransactionId: record.payosTransactionId }),
  };
}

function requireDate(value: Date | undefined, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  throw new TypeError(`${field} must be a valid date`);
}

export class SubscriptionPersistenceMapper {
  static toEntity(record: SubscriptionPersistenceRecord): SubscriptionRecord {
    const base = {
      id: serializeId(record._id, 'subscription._id'),
      userId: serializeId(record.user, 'subscription.user'),
      userEmail: record.userEmail,
      planId: record.planId,
      planName: record.planName,
      amount: record.amount,
      currency: record.currency,
      payosOrderId: record.payosOrderId,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.payosTransactionId === undefined
        ? {}
        : { payosTransactionId: record.payosTransactionId }),
      ...(record.payosPaymentUrl === undefined ? {} : { payosPaymentUrl: record.payosPaymentUrl }),
    };

    if (record.status === 'completed') {
      return {
        ...base,
        status: record.status,
        startDate: requireDate(record.startDate, 'subscription.startDate'),
        ...(record.endDate === undefined ? {} : { endDate: record.endDate }),
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
      ...(record.startDate === undefined ? {} : { startDate: record.startDate }),
      ...(record.endDate === undefined ? {} : { endDate: record.endDate }),
    };
  }
}
