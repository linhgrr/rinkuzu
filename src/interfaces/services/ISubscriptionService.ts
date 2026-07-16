import type { AdminSubscriptionDto, UpdateSubscriptionRequestDto } from '@/dtos/admin-billing';
import type {
  PaymentRequestDto,
  SubscriptionActivationDto,
  SubscriptionCancellationDto,
  SubscriptionPlanDto,
  SubscriptionStatusResponseDto,
  VerifiedPaymentDto,
} from '@/dtos/subscription';
import type { ServiceResult } from '@/interfaces/services/types';

export interface ISubscriptionService {
  getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponseDto>;
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
  cancelSubscription(userId: string): Promise<SubscriptionCancellationDto>;
  getSubscriptionPlans(): Promise<SubscriptionPlanDto[]>;
  checkAndUpdateExpiredSubscriptions(): Promise<number>;
  updateSubscriptionById(
    id: string,
    update: UpdateSubscriptionStatusInput,
  ): Promise<ServiceResult<AdminSubscriptionDto>>;
}

export interface UpdateSubscriptionStatusInput {
  status: UpdateSubscriptionRequestDto['status'];
}
