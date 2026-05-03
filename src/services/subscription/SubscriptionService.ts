import connectDB from '@/lib/mongoose';
import crypto from 'crypto';
import Plan from '@/models/Plan';
import {
  ISubscriptionService,
  SubscriptionPlan,
  PaymentRequest,
  SubscriptionActivation,
} from '@/interfaces/services/ISubscriptionService';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { DurationUtils } from '@/types/subscription';

export class SubscriptionService implements ISubscriptionService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
  ) {}

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
    await connectDB();

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get plan from database
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new Error('Invalid subscription plan');
    }

    // Check if user already has an active subscription
    const hasActivePremium = await this.isUserPremium(userId);
    if (hasActivePremium) {
      throw new Error('User already has an active subscription');
    }

    // PayOS requires a positive safe integer. Add entropy and verify uniqueness.
    const orderCode = await this.generateUniqueOrderCode();

    // PayOS description phải ≤ 25 ký tự
    const payosDescription = plan.name.length > 25 ? plan.name.substring(0, 25) : plan.name;

    // Create subscription record
    await this.subscriptionRepository.create({
      user: userId as any,
      userEmail: user.email,
      type: planId,
      amount: plan.price,
      currency: 'VND',
      status: 'pending',
      payosOrderId: orderCode.toString(),
    });

    // Create payment request with PayOS
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    const returnUrl = `${baseUrl}/payment/success?orderCode=${orderCode}`;
    const cancelUrl = `${baseUrl}/payment/cancel?orderCode=${orderCode}`;

    try {
      console.warn('Creating PayOS payment request:', {
        orderCode,
        amount: plan.price,
        description: payosDescription,
        returnUrl,
        cancelUrl,
        buyerEmail: user.email,
        buyerName: (user as any).name,
      });

      const paymentResponse = await this.payosService.createPayment(
        orderCode,
        plan.price,
        payosDescription,
        returnUrl,
        cancelUrl,
        user.email,
        (user as any).name,
      );

      console.warn('PayOS payment response:', paymentResponse);

      if (paymentResponse.code !== '00') {
        console.error('PayOS payment error:', paymentResponse);
        throw new Error(paymentResponse.desc || 'Failed to create payment request');
      }

      if (!paymentResponse.data?.checkoutUrl) {
        console.error('PayOS response missing payment URL:', paymentResponse);
        throw new Error('Payment URL not received from PayOS');
      }

      // Update subscription with payment URL
      await this.subscriptionRepository.updateByOrderId(orderCode.toString(), {
        payosPaymentUrl: paymentResponse.data.checkoutUrl,
      });

      return {
        orderCode,
        paymentUrl: paymentResponse.data.checkoutUrl,
        qrCode: paymentResponse.data.qrCode,
        amount: plan.price,
        plan: plan,
      };
    } catch (error) {
      console.error('Error in createPaymentRequest:', error);

      // Clean up the subscription record if payment creation failed
      try {
        await this.subscriptionRepository.deleteByOrderId(orderCode.toString());
      } catch (cleanupError) {
        console.error('Failed to cleanup subscription record:', cleanupError);
      }

      throw error;
    }
  }

  async verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivation> {
    await connectDB();

    // Get subscription record
    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.user.toString() !== userId) {
      throw new Error('Subscription does not belong to current user');
    }

    if (subscription.status === 'completed') {
      if (subscription.endDate && new Date(subscription.endDate) <= new Date()) {
        throw new Error('Subscription already expired');
      }

      return {
        success: true,
        subscription: {
          type: subscription.type,
          startDate: subscription.startDate || subscription.createdAt,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
        },
      };
    }

    if (subscription.status !== 'pending') {
      throw new Error(`Cannot verify subscription with status ${subscription.status}`);
    }

    // Verify payment with PayOS
    const paymentInfo = await this.payosService.verifyPayment(orderCode);

    if (paymentInfo.code !== '00') {
      throw new Error(paymentInfo.desc || 'Failed to verify payment');
    }

    // Check if payment is successful (status PAID)
    if (paymentInfo.data?.status !== 'PAID') {
      throw new Error('Payment not completed');
    }

    if (String(paymentInfo.data?.orderCode) !== orderCode.toString()) {
      throw new Error('Payment order code mismatch');
    }

    if (Number(paymentInfo.data?.amount) !== subscription.amount) {
      throw new Error('Payment amount mismatch');
    }

    return this.activateSubscription(subscription, orderCode, paymentInfo.data?.reference);
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
    await connectDB();

    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === 'completed') {
      return {
        success: true,
        subscription: {
          type: subscription.type,
          startDate: subscription.startDate || subscription.createdAt,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
        },
      };
    }

    if (subscription.status !== 'pending') {
      throw new Error(`Cannot activate subscription with status ${subscription.status}`);
    }

    if (String(paymentData.orderCode) !== orderCode.toString()) {
      throw new Error('Payment order code mismatch');
    }

    if (Number(paymentData.amount) !== subscription.amount) {
      throw new Error('Payment amount mismatch');
    }

    if (paymentData.status && paymentData.status !== 'PAID') {
      throw new Error('Payment not completed');
    }

    if (paymentData.code && paymentData.code !== '00') {
      throw new Error('Payment not successful');
    }

    return this.activateSubscription(subscription, orderCode, paymentData.reference);
  }

  private async activateSubscription(
    subscription: any,
    orderCode: number,
    transactionReference?: string,
  ): Promise<SubscriptionActivation> {
    // Calculate subscription dates using new duration system
    const plan = await Plan.findById(subscription.type);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const startDate = new Date();
    let endDate: Date | undefined;

    try {
      // Use new ISO 8601 duration system
      endDate = DurationUtils.calculateEndDate(startDate, plan.durationInfo.iso8601);
    } catch (error) {
      console.warn('Using fallback duration calculation for plan:', plan.name, error);

      // Fallback to legacy parsing for existing plans
      const durationText = plan.duration.toLowerCase();
      if (durationText.includes('tháng') || durationText.includes('month')) {
        const months = parseInt(durationText.match(/\d+/)?.[0] || '0');
        if (months > 0) {
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + months);
        }
      } else if (durationText === 'lifetime') {
        endDate = undefined; // Lifetime subscription
      }
    }

    // Update subscription status
    await this.subscriptionRepository.updateByOrderId(orderCode.toString(), {
      status: 'completed',
      payosTransactionId: transactionReference,
      startDate,
      endDate,
      isActive: true,
    });

    // Update user subscription
    await this.userRepository.updateById(subscription.user.toString(), {
      subscription: {
        type: subscription.type,
        startDate,
        endDate,
        isActive: true,
        payosOrderId: orderCode.toString(),
        payosTransactionId: transactionReference,
      },
    });

    return {
      success: true,
      subscription: {
        type: subscription.type,
        startDate,
        endDate,
        isActive: true,
      },
    };
  }

  async getSubscriptionHistory(userId: string) {
    return await this.subscriptionRepository.findByUser(userId);
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has an active subscription with end date (time-limited subscription)
    if (!(user as any).subscription?.endDate) {
      throw new Error('Only time-limited subscriptions can be cancelled');
    }

    // Update user subscription to inactive
    await this.userRepository.updateById(userId, {
      'subscription.isActive': false,
    });

    // Update subscription record - find the active subscription for this user
    const subscriptions = await this.subscriptionRepository.findByUser(userId);
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'completed' && sub.isActive,
    );

    if (activeSubscription) {
      await this.subscriptionRepository.updateById((activeSubscription as any)._id.toString(), {
        isActive: false,
      });
    }

    return { success: true };
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

      if (update.status !== undefined) {
        const normalizedStatus = update.status === 'active' ? 'completed' : update.status;
        if (!allowedStatuses.includes(normalizedStatus)) {
          return { success: false, error: 'Invalid subscription status' };
        }
        sanitizedUpdate.status = normalizedStatus;
        sanitizedUpdate.isActive = normalizedStatus === 'completed';
      }

      if (update.isActive !== undefined) {
        sanitizedUpdate.isActive = Boolean(update.isActive);
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return { success: false, error: 'No valid subscription fields provided' };
      }

      const updated = await this.subscriptionRepository.updateById(id, sanitizedUpdate);
      if (!updated) {
        return { success: false, error: 'Subscription not found' };
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
      return { success: false, error: (error as any)?.message || 'Failed to update subscription' };
    }
  }

  private async generateUniqueOrderCode(): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderCode = Date.now() * 1000 + crypto.randomInt(0, 1000);
      const existing = await this.subscriptionRepository.findByOrderId(orderCode.toString());
      if (!existing) return orderCode;
    }

    throw new Error('Failed to generate unique payment order code');
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
