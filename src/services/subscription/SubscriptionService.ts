import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import type { ISubscription } from '@/models/Subscription';
import {
  ISubscriptionService,
  SubscriptionPlan,
  PaymentRequest,
  SubscriptionActivation,
} from '@/interfaces/services/ISubscriptionService';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { ServiceResult } from '@/interfaces/services/types';

import { SubscriptionPaymentService } from './SubscriptionPaymentService';
import { SubscriptionActivationService } from './SubscriptionActivationService';

// Embedded subscription snapshot stored on the User document.
// Mirrors the `User.subscription` field declared in src/models/User.ts
// and aligns with `UserSubscription` in ISubscriptionService.
interface UserSubscriptionEmbed {
  type?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  status?: string;
  payosOrderId?: string;
  payosTransactionId?: string;
}

interface UserWithSubscription {
  _id: { toString(): string };
  subscription?: UserSubscriptionEmbed;
}

interface PlanRecord {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

interface SubscriptionWithId extends ISubscription {
  _id: { toString(): string };
}

export class SubscriptionService implements ISubscriptionService {
  private paymentService: SubscriptionPaymentService;
  private activationService: SubscriptionActivationService;

  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
  ) {
    this.paymentService = new SubscriptionPaymentService(
      subscriptionRepository,
      userRepository,
      payosService,
    );
    this.activationService = new SubscriptionActivationService(
      subscriptionRepository,
      userRepository,
      payosService,
    );
  }

  async getUserSubscription(userId: string) {
    const user = (await this.userRepository.findById(userId)) as UserWithSubscription | null;
    const subscription = user?.subscription;
    if (!subscription) return null;

    if (this.isExpired(subscription)) {
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
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;

    // Check if subscription is active
    if (!subscription.isActive) return false;

    // Check if subscription has end date
    if (subscription.endDate) {
      return !this.isExpired(subscription);
    }

    // If no end date, assume it's a lifetime subscription
    return true;
  }

  async createPaymentRequest(userId: string, planId: string): Promise<PaymentRequest> {
    return this.paymentService.createPaymentRequest(userId, planId);
  }

  async verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivation> {
    return this.activationService.verifyAndActivateSubscription(orderCode, userId);
  }

  async activateVerifiedSubscription(
    orderCode: number,
    paymentData: {
      orderCode: string | number;
      amount: string | number;
      reference?: string;
      status?: string;
      code?: string;
    },
  ): Promise<SubscriptionActivation> {
    return this.activationService.activateVerifiedSubscription(orderCode, paymentData);
  }

  async getSubscriptionHistory(userId: string): Promise<ISubscription[]> {
    return this.subscriptionRepository.findByUser(userId);
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean }> {
    return this.activationService.cancelSubscription(userId);
  }

  async checkAndUpdateExpiredSubscriptions(): Promise<number> {
    const expiredSubscriptions = await this.subscriptionRepository.findExpiredSubscriptions();
    const updatedUserIds = new Set<string>();

    const expiredSubscriptionUserIds = await Promise.all(
      expiredSubscriptions.map(async (subscription) => {
        const subWithId = subscription as SubscriptionWithId;
        const userId = subscription.user.toString();

        await Promise.all([
          this.subscriptionRepository.updateById(subWithId._id.toString(), {
            isActive: false,
            status: 'expired',
          }),
          this.userRepository.updateById(userId, {
            'subscription.isActive': false,
          }),
        ]);

        return userId;
      }),
    );
    expiredSubscriptionUserIds.forEach((userId) => updatedUserIds.add(userId));

    const expiredUsers = (await this.userRepository.findExpiredSubscriptionUsers()) as
      | UserWithSubscription[]
      | undefined;
    const expiredUserIds = await Promise.all(
      (expiredUsers ?? []).map(async (user) => {
        const userId = user._id.toString();
        await this.markUserSubscriptionExpired(userId, user.subscription);
        return userId;
      }),
    );
    expiredUserIds.forEach((userId) => updatedUserIds.add(userId));

    return updatedUserIds.size;
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await connectDB();

    try {
      // Get plans from database
      const plans = (await Plan.find({ isActive: true }).lean()) as unknown as PlanRecord[];

      // Convert to SubscriptionPlan format
      return plans.map((plan) => ({
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        duration: plan.duration,
        features: plan.features,
      }));
    } catch (error) {
      console.error('Error fetching plans from database:', error);
      // Return empty array if database error
      return [];
    }
  }

  async updateSubscriptionById(
    id: string,
    update: Partial<ISubscription> & { status?: string; isActive?: boolean },
  ): Promise<ServiceResult<ISubscription>> {
    try {
      const allowedStatuses = ['pending', 'completed', 'failed', 'cancelled', 'expired'];
      const sanitizedUpdate: Partial<ISubscription> = {};

      if (update.status !== undefined) {
        if (!allowedStatuses.includes(update.status)) {
          return { success: false, error: 'Invalid subscription status', statusCode: 400 };
        }
        sanitizedUpdate.status = update.status as ISubscription['status'];
        sanitizedUpdate.isActive = update.status === 'completed';
      }

      if (update.isActive !== undefined) {
        sanitizedUpdate.isActive = Boolean(update.isActive);
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return {
          success: false,
          error: 'No valid subscription fields provided',
          statusCode: 400,
        };
      }

      const updated = await this.subscriptionRepository.updateById(id, sanitizedUpdate);
      if (!updated) {
        return { success: false, error: 'Subscription not found', statusCode: 404 };
      }
      // Nếu có userId, cập nhật luôn user.subscription
      if (sanitizedUpdate.isActive !== undefined || sanitizedUpdate.status) {
        const sub = await this.subscriptionRepository.findById(id);
        if (sub && sub.user) {
          await this.userRepository.updateById(sub.user.toString(), {
            ...(sanitizedUpdate.isActive !== undefined && {
              'subscription.isActive': sanitizedUpdate.isActive,
            }),
          });
        }
      }
      return { success: true, data: updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update subscription';
      return { success: false, error: message, statusCode: 500 };
    }
  }

  private isExpired(subscription: { endDate?: Date | string | null }): boolean {
    if (!subscription.endDate) return false;
    const endDate = new Date(subscription.endDate);
    return Number.isFinite(endDate.getTime()) && endDate.getTime() <= Date.now();
  }

  private async markUserSubscriptionExpired(
    userId: string,
    subscription?: { payosOrderId?: string; endDate?: Date | string | null },
  ) {
    await this.userRepository.updateById(userId, {
      'subscription.isActive': false,
    });

    if (subscription?.payosOrderId) {
      await this.subscriptionRepository.updateByOrderId(subscription.payosOrderId, {
        isActive: false,
        status: 'expired',
      });
    }
  }
}
