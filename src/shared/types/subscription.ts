import type { SubscriptionStatus } from '@/shared/constants/subscription-status';

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
