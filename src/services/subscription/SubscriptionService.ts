import { ISubscriptionService } from '@/interfaces/services/ISubscriptionService';
import type {
  PaymentRequestDto,
  SubscriptionActivationDto,
  SubscriptionCancellationDto,
  SubscriptionHistoryItemDto,
  SubscriptionPlanDto,
  SubscriptionStatusResponseDto,
  VerifiedPaymentDto,
} from '@/dtos/subscription';
import type { AdminSubscriptionDto } from '@/dtos/admin-billing';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import type { UserSubscription } from '@/entities/Subscription';
import type { UpdateSubscriptionStatusInput } from '@/interfaces/services/ISubscriptionService';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { isSubscriptionExpired, type SubscriptionExpiryInput } from '@/lib/subscription-date';
import { SubscriptionDtoMapper } from '@/mappers/subscription/SubscriptionDtoMapper';

import { SubscriptionPaymentService } from './SubscriptionPaymentService';
import { SubscriptionActivationService } from './SubscriptionActivationService';

interface ExpirableUserSubscription extends SubscriptionExpiryInput {
  payosOrderId?: string;
}

export class SubscriptionService implements ISubscriptionService {
  private paymentService: SubscriptionPaymentService;
  private activationService: SubscriptionActivationService;

  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
    private planRepository: ISubscriptionPlanRepository,
  ) {
    this.paymentService = new SubscriptionPaymentService(
      subscriptionRepository,
      userRepository,
      payosService,
      planRepository,
    );
    this.activationService = new SubscriptionActivationService(
      subscriptionRepository,
      userRepository,
      payosService,
      planRepository,
    );
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponseDto> {
    const subscription = await this.getUserSubscriptionSnapshot(userId);
    return SubscriptionDtoMapper.toStatusResponse(
      subscription,
      this.isSubscriptionSnapshotPremium(subscription),
    );
  }

  private async getUserSubscriptionSnapshot(userId: string): Promise<UserSubscription | null> {
    const user = await this.userRepository.findById(userId);
    const subscription = user?.subscription;
    if (!subscription) return null;

    if (isSubscriptionExpired(subscription)) {
      await this.markUserSubscriptionExpired(userId, subscription);
      return {
        ...subscription,
        isActive: false,
        status: 'expired',
      };
    }

    return subscription;
  }

  async isUserPremium(userId: string): Promise<boolean> {
    return this.isSubscriptionSnapshotPremium(await this.getUserSubscriptionSnapshot(userId));
  }

  async createPaymentRequest(userId: string, planId: string): Promise<PaymentRequestDto> {
    return this.paymentService.createPaymentRequest(userId, planId);
  }

  async verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivationDto> {
    return this.activationService.verifyAndActivateSubscription(orderCode, userId);
  }

  async activateVerifiedSubscription(
    orderCode: number,
    paymentData: VerifiedPaymentDto,
  ): Promise<SubscriptionActivationDto> {
    return this.activationService.activateVerifiedSubscription(orderCode, paymentData);
  }

  async getSubscriptionHistory(userId: string): Promise<SubscriptionHistoryItemDto[]> {
    const subscriptions = await this.subscriptionRepository.findByUser(userId);
    return subscriptions.map(SubscriptionDtoMapper.toHistoryItem);
  }

  async cancelSubscription(userId: string): Promise<SubscriptionCancellationDto> {
    return this.activationService.cancelSubscription(userId);
  }

  async checkAndUpdateExpiredSubscriptions(): Promise<number> {
    return this.subscriptionRepository.expireDue(new Date());
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlanDto[]> {
    try {
      const plans = await this.planRepository.listActive();
      return plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        duration: plan.duration,
        features: plan.features,
      }));
    } catch (error) {
      logger.error({ error }, 'Error fetching plans from database');
      // Return empty array if database error
      return [];
    }
  }

  async updateSubscriptionById(
    id: string,
    update: UpdateSubscriptionStatusInput,
  ): Promise<ServiceResult<AdminSubscriptionDto>> {
    try {
      const result = await this.subscriptionRepository.updateAdminStatusById(id, update.status);
      if (result.outcome === 'not_found') {
        return { success: false, error: 'Subscription not found', statusCode: 404 };
      }
      if (result.outcome === 'invalid_transition') {
        return {
          success: false,
          error: `Cannot change subscription status from ${result.currentStatus} to ${update.status}`,
          statusCode: 409,
        };
      }
      return {
        success: true,
        data: SubscriptionDtoMapper.toAdminSubscriptionDto(result.subscription),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update subscription';
      return { success: false, error: message, statusCode: 500 };
    }
  }

  private isSubscriptionSnapshotPremium(subscription: UserSubscription | null): boolean {
    if (!subscription) return false;
    if (!subscription.isActive) return false;
    return subscription.endDate ? !isSubscriptionExpired(subscription) : true;
  }

  private async markUserSubscriptionExpired(
    userId: string,
    subscription: ExpirableUserSubscription,
  ): Promise<void> {
    if (!subscription.payosOrderId) {
      throw new TypeError('Expired subscription is missing payosOrderId');
    }
    const expired = await this.subscriptionRepository.expireCurrentForUser(
      userId,
      subscription.payosOrderId,
    );
    if (!expired) {
      throw new Error('Current subscription record is inconsistent');
    }
  }
}
