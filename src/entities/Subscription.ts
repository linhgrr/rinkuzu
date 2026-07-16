export type SubscriptionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
export type AdminMutableSubscriptionStatus = Extract<
  SubscriptionStatus,
  'failed' | 'cancelled' | 'expired'
>;

export interface SubscriptionRecordFields {
  userEmail: string;
  type: string;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
