import type { SubscriptionRecord } from '@/entities/Subscription';
import type {
  AdminMutableSubscriptionStatus,
  SubscriptionStatus,
} from '@/shared/constants/subscription-status';
export interface ActivateSubscriptionData {
  orderId: string;
  userId: string;
  type: string;
  startDate: Date;
  endDate?: Date;
  transactionReference?: string;
}

export interface CreateSubscriptionData {
  userId: string;
  userEmail: string;
  type: string;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  payosOrderId: string;
}

export interface UpdateSubscriptionData {
  status?: SubscriptionStatus;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export type AdminSubscriptionStatusUpdateResult =
  | { outcome: 'updated'; subscription: SubscriptionRecord }
  | { outcome: 'not_found' }
  | { outcome: 'invalid_transition'; currentStatus: SubscriptionStatus };

export type CancelCurrentSubscriptionResult =
  | { outcome: 'cancelled' }
  | { outcome: 'already_inactive' }
  | { outcome: 'user_not_found' }
  | { outcome: 'not_time_limited' }
  | { outcome: 'inconsistent_record' };

/** Minimal batch-expiry metadata: unique users touched after a successful commit. */
export interface ExpireDueResult {
  count: number;
  userIds: string[];
}

export interface ISubscriptionRepository {
  create(subscriptionData: CreateSubscriptionData): Promise<SubscriptionRecord>;
  findById(id: string): Promise<SubscriptionRecord | null>;
  findByOrderId(orderId: string): Promise<SubscriptionRecord | null>;
  findByTransactionReference(transactionReference: string): Promise<SubscriptionRecord | null>;
  expireDue(now: Date): Promise<ExpireDueResult>;
  updateById(id: string, updateData: UpdateSubscriptionData): Promise<SubscriptionRecord | null>;
  updateByOrderId(
    orderId: string,
    updateData: UpdateSubscriptionData,
  ): Promise<SubscriptionRecord | null>;
  updateAdminStatusById(
    id: string,
    status: AdminMutableSubscriptionStatus,
  ): Promise<AdminSubscriptionStatusUpdateResult>;
  expireCurrentForUser(userId: string, orderId: string): Promise<boolean>;
  cancelCurrentForUser(userId: string): Promise<CancelCurrentSubscriptionResult>;
  activateSubscription(data: ActivateSubscriptionData): Promise<void>;
}
