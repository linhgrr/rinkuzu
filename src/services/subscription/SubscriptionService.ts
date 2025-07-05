import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Plan from '@/models/Plan';
import { ISubscriptionService, SubscriptionPlan, PaymentRequest, SubscriptionActivation } from '@/interfaces/services/ISubscriptionService';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { DurationUtils } from '@/types/subscription'

export class SubscriptionService implements ISubscriptionService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService
  ) {}

  async getUserSubscription(userId: string) {
    const user = await this.userRepository.findById(userId);
    return (user as any)?.subscription;
  }

  async isUserPremium(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;

    // Check if subscription is active
    if (!subscription.isActive) return false;

    // Check if subscription has end date
    if (subscription.endDate) {
      return new Date() < subscription.endDate;
    }

    // If no end date, assume it's a lifetime subscription
    return true;
  }

  async createPaymentRequest(
    userId: string,
    planId: string
  ): Promise<PaymentRequest> {
    await connectDB();

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get plan from database
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new Error('Invalid subscription plan');
    }

    // Check if user already has an active subscription
    const currentSubscription = await this.getUserSubscription(userId);
    if (currentSubscription?.isActive) {
      throw new Error('User already has an active subscription');
    }

    // Generate unique numeric order code (PayOS requires positive number <= 9007199254740991)
    const orderCode = Date.now();

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
      console.log('Creating PayOS payment request:', {
        orderCode,
        amount: plan.price,
        description: payosDescription,
        returnUrl,
        cancelUrl,
        buyerEmail: user.email,
        buyerName: (user as any).name
      });

      const paymentResponse = await this.payosService.createPayment(
        orderCode,
        plan.price,
        payosDescription,
        returnUrl,
        cancelUrl,
        user.email,
        (user as any).name
      );

      console.log('PayOS payment response:', paymentResponse);

      if (paymentResponse.code !== '00') {
        console.error('PayOS payment error:', paymentResponse);
        throw new Error(paymentResponse.desc || 'Failed to create payment request');
      }

      if (!paymentResponse.data?.checkoutUrl) {
        console.error('PayOS response missing payment URL:', paymentResponse);
        throw new Error('Payment URL not received from PayOS');
      }

      // Update subscription with payment URL
      await this.subscriptionRepository.updateByOrderId(
        orderCode.toString(),
        { payosPaymentUrl: paymentResponse.data.checkoutUrl }
      );

      return {
        orderCode,
        paymentUrl: paymentResponse.data.checkoutUrl,
        qrCode: paymentResponse.data.qrCode,
        amount: plan.price,
        plan: plan
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

  async verifyAndActivateSubscription(orderCode: number): Promise<SubscriptionActivation> {
    await connectDB();

    // Get subscription record
    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get plan to determine duration
    const plan = await Plan.findById(subscription.type);
    if (!plan) {
      throw new Error('Plan not found');
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

    // Calculate subscription dates using new duration system
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
        payosTransactionId: paymentInfo.data?.reference,
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
        payosTransactionId: paymentInfo.data?.reference,
      }
    });

    return {
      success: true,
      subscription: {
        type: subscription.type,
        startDate,
        endDate,
        isActive: true,
      }
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
    const activeSubscription = subscriptions.find(sub => sub.status === 'completed' && sub.isActive);
    
    if (activeSubscription) {
      await this.subscriptionRepository.updateById((activeSubscription as any)._id.toString(), {
        isActive: false
      });
    }

    return { success: true };
  }

  async checkAndUpdateExpiredSubscriptions(): Promise<void> {
    const expiredSubscriptions = await this.subscriptionRepository.findExpiredSubscriptions();
    
    for (const subscription of expiredSubscriptions) {
      // Update subscription to inactive
      await this.subscriptionRepository.updateById((subscription as any)._id.toString(), {
        isActive: false,
        status: 'expired'
      });
      
      // Update user subscription to inactive
      await this.userRepository.updateById(subscription.user.toString(), {
        'subscription.isActive': false
      });
    }
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await connectDB();
    
    try {
      // Get plans from database
      const plans = await Plan.find({ isActive: true }).lean() as any[];
      
      // Convert to SubscriptionPlan format
      return plans.map(plan => ({
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        duration: plan.duration,
        features: plan.features
      }));
    } catch (error) {
      console.error('Error fetching plans from database:', error);
      // Return empty array if database error
      return [];
    }
  }

  async updateSubscriptionById(id: string, update: Partial<any>): Promise<{ success: boolean, data?: any, error?: string }> {
    try {
      const updated = await this.subscriptionRepository.updateById(id, update)
      if (!updated) {
        return { success: false, error: 'Subscription not found' }
      }
      // Nếu có userId, cập nhật luôn user.subscription
      if (update.isActive !== undefined || update.status) {
        const sub = await this.subscriptionRepository.findById(id)
        if (sub && sub.user) {
          await this.userRepository.updateById(sub.user.toString(), {
            'subscription.isActive': update.isActive,
            'subscription.status': update.status
          })
        }
      }
      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: (error as any)?.message || 'Failed to update subscription' }
    }
  }
}

export default SubscriptionService; 