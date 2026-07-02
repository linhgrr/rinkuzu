import type {
  AdminMutableSubscriptionStatus,
  SubscriptionRecord,
  UserSubscription,
} from '@/entities/Subscription';
import type {
  PaymentRequestDto,
  SubscriptionActivationDto,
  SubscriptionCancellationDto,
  SubscriptionPlanDto,
  VerifiedPaymentDto,
} from '@/dtos/subscription';
import type { ServiceResult } from '@/interfaces/services/types';

export interface ISubscriptionService {
  getUserSubscription(userId: string): Promise<UserSubscription | null>;
  isUserPremium(userId: string): Promise<boolean>;
  createPaymentRequest(userId: string, planId: string): Promise<PaymentRequestDto>;
  verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivationDto>;
  activateVerifiedSubscription(
    orderCode: number,
    paymentData: VerifiedPaymentDto,
  ): Promise<SubscriptionActivationDto>;
  getSubscriptionHistory(userId: string): Promise<SubscriptionRecord[]>;
  cancelSubscription(userId: string): Promise<SubscriptionCancellationDto>;
  getSubscriptionPlans(): Promise<SubscriptionPlanDto[]>;
  checkAndUpdateExpiredSubscriptions(): Promise<number>;
  updateSubscriptionById(
    id: string,
    update: UpdateSubscriptionStatusInput,
  ): Promise<ServiceResult<SubscriptionRecord>>;
}

export interface UpdateSubscriptionStatusInput {
  status: AdminMutableSubscriptionStatus;
}
