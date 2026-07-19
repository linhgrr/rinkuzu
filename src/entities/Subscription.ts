import type {
  AdminMutableSubscriptionStatus,
  SubscriptionStatus,
} from '@/shared/constants/subscription-status';
import type { SubscriptionRecordFields } from '@/shared/types/subscription';

export class SubscriptionActivationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionActivationConflictError';
  }
}

export function isAdminSubscriptionStatusTransitionAllowed(
  currentStatus: SubscriptionStatus,
  nextStatus: AdminMutableSubscriptionStatus,
): boolean {
  if (currentStatus === 'pending') {
    return nextStatus === 'failed' || nextStatus === 'cancelled';
  }
  if (currentStatus === 'completed') {
    return nextStatus === 'cancelled' || nextStatus === 'expired';
  }
  return false;
}

interface SubscriptionRecordBase extends Omit<
  SubscriptionRecordFields,
  'status' | 'startDate' | 'endDate'
> {
  id: string;
  userId: string;
}

export type SubscriptionRecord =
  | (SubscriptionRecordBase & {
      status: 'completed';
      startDate: Date;
      endDate?: Date;
    })
  | (SubscriptionRecordBase & {
      status: 'expired';
      startDate: Date;
      endDate: Date;
    })
  | (SubscriptionRecordBase & {
      status: Exclude<SubscriptionStatus, 'completed' | 'expired'>;
      startDate?: Date;
      endDate?: Date;
    });

export interface UserSubscription {
  type: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
  status?: SubscriptionStatus;
}
