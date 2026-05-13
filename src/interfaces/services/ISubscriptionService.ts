import type { ISubscription } from '@/models/Subscription';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

export interface PaymentRequest {
  orderCode: number;
  paymentUrl: string;
  qrCode?: string;
  amount: number;
  plan: SubscriptionPlan;
}

export interface SubscriptionActivation {
  success: boolean;
  subscription: {
    type: string;
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
  };
}

export interface UserSubscription {
  type?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
  status?: string;
}

export interface ISubscriptionService {
  getUserSubscription(userId: string): Promise<UserSubscription | null>;
  isUserPremium(userId: string): Promise<boolean>;
  createPaymentRequest(userId: string, planId: string): Promise<PaymentRequest>;
  verifyAndActivateSubscription(orderCode: number, userId: string): Promise<SubscriptionActivation>;
  activateVerifiedSubscription(
    orderCode: number,
    paymentData: {
      orderCode: string | number;
      amount: string | number;
      reference?: string;
      status?: string;
      code?: string;
    },
  ): Promise<SubscriptionActivation>;
  getSubscriptionHistory(userId: string): Promise<ISubscription[]>;
  cancelSubscription(userId: string): Promise<{ success: boolean }>;
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  checkAndUpdateExpiredSubscriptions(): Promise<number>;
  updateSubscriptionById(
    id: string,
    update: Record<string, unknown>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }>;
}
