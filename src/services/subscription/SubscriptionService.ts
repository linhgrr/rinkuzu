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

import { SubscriptionPaymentService } from './SubscriptionPaymentService';
import { SubscriptionActivationService } from './SubscriptionActivationService';

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
    const user = await this.userRepository.findById(userId);
    const subscription = (user as any)?.subscription;
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
    return await this.subscriptionRepository.findByUser(userId);
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean }> {
    return this.activationService.cancelSubscription(userId);
  }

  async checkAndUpdateExpiredSubscriptions(): Promise<number> {
    const expiredSubscriptions = await this.subscriptionRepository.findExpiredSubscriptions();
    const updatedUserIds = new Set<string>();

    for (const subscription of expiredSubscriptions) {
      // Update subscription to inactive
      await this.subscriptionRepository.updateById((subscription as any)._id.toString(), {
        isActive: false,
        status: 'expired',
      });

      // Update user subscription to inactive
      await this.userRepository.updateById(subscription.user.toString(), {
        'subscription.isActive': false,
      });
      updatedUserIds.add(subscription.user.toString());
    }

    const expiredUsers = await this.userRepository.findExpiredSubscriptionUsers();
    for (const user of expiredUsers) {
      await this.markUserSubscriptionExpired(
        (user as any)._id.toString(),
        (user as any).subscription,
      );
      updatedUserIds.add((user as any)._id.toString());
    }

    return updatedUserIds.size;
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await connectDB();

    try {
      // Get plans from database
      const plans = (await Plan.find({ isActive: true }).lean()) as any[];

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
    update: Partial<any>,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const allowedStatuses = ['pending', 'completed', 'failed', 'cancelled', 'expired'];
      const sanitizedUpdate: Partial<any> = {};

      if (update['status'] !== undefined) {
        if (!allowedStatuses.includes(update['status'])) {
          return { success: false, error: 'Invalid subscription status' };
        }
        sanitizedUpdate['status'] = update['status'];
        sanitizedUpdate['isActive'] = update['status'] === 'completed';
      }

      if (update['isActive'] !== undefined) {
        sanitizedUpdate['isActive'] = Boolean(update['isActive']);
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return { success: false, error: 'No valid subscription fields provided' };
      }

      const updated = await this.subscriptionRepository.updateById(id, sanitizedUpdate);
      if (!updated) {
        return { success: false, error: 'Subscription not found' };
      }
      // Nếu có userId, cập nhật luôn user.subscription
      if (sanitizedUpdate['isActive'] !== undefined || sanitizedUpdate['status']) {
        const sub = await this.subscriptionRepository.findById(id);
        if (sub && sub.user) {
          await this.userRepository.updateById(sub.user.toString(), {
            ...(sanitizedUpdate['isActive'] !== undefined && {
              'subscription.isActive': sanitizedUpdate['isActive'],
            }),
          });
        }
      }
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: (error as any)?.message || 'Failed to update subscription' };
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

export default SubscriptionService;
