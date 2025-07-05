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
  plan: any;
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

export interface ISubscriptionService {
  getUserSubscription(userId: string): Promise<any>;
  isUserPremium(userId: string): Promise<boolean>;
  createPaymentRequest(userId: string, planId: string): Promise<PaymentRequest>;
  verifyAndActivateSubscription(orderCode: number): Promise<SubscriptionActivation>;
  getSubscriptionHistory(userId: string): Promise<any[]>;
  cancelSubscription(userId: string): Promise<{ success: boolean }>;
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  checkAndUpdateExpiredSubscriptions(): Promise<void>;
  updateSubscriptionById(id: string, update: Partial<any>): Promise<{ success: boolean, data?: any, error?: string }>;
} 