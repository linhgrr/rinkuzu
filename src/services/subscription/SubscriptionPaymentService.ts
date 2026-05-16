import connectDB from '@/lib/mongoose';
import crypto from 'crypto';
import Plan from '@/models/Plan';
import { PaymentRequest } from '@/interfaces/services/ISubscriptionService';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';

export class SubscriptionPaymentService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
  ) {}

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
    const hasActivePremium = await this.isUserPremiumInternal(userId);
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
    const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3001';
    const returnUrl = `${baseUrl}/payment/success?orderCode=${orderCode}`;
    const cancelUrl = `${baseUrl}/payment/cancel?orderCode=${orderCode}`;

    try {
      console.warn('Creating PayOS payment request:', {
        orderCode,
        amount: plan.price,
        description: payosDescription,
        returnUrl,
        cancelUrl,
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

      if (paymentResponse.code !== '00') {
        console.error('PayOS payment error:', {
          orderCode,
          code: paymentResponse.code,
          description: paymentResponse.desc,
        });
        throw new Error(paymentResponse.desc || 'Failed to create payment request');
      }

      if (!paymentResponse.data?.checkoutUrl) {
        console.error('PayOS response missing payment URL:', {
          orderCode,
          code: paymentResponse.code,
        });
        throw new Error('Payment URL not received from PayOS');
      }

      const checkoutUrl = assertTrustedPayosCheckoutUrl(paymentResponse.data.checkoutUrl);

      // Update subscription with payment URL
      await this.subscriptionRepository.updateByOrderId(orderCode.toString(), {
        payosPaymentUrl: checkoutUrl,
      });

      return {
        orderCode,
        paymentUrl: checkoutUrl,
        qrCode: paymentResponse.data.qrCode,
        amount: plan.price,
        plan: {
          id: plan._id.toString(),
          name: plan.name,
          price: plan.price,
          duration: plan.duration,
          features: plan.features,
        },
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

  private async isUserPremiumInternal(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    const subscription = (user as any)?.subscription;
    if (!subscription) return false;
    if (!subscription.isActive) return false;
    if (subscription.endDate) {
      return !this.isExpired(subscription);
    }
    return true;
  }

  private isExpired(subscription: { endDate?: Date | string | null }): boolean {
    if (!subscription.endDate) return false;
    const endDate = new Date(subscription.endDate);
    return Number.isFinite(endDate.getTime()) && endDate.getTime() <= Date.now();
  }

  private async generateUniqueOrderCode(): Promise<number> {
    const findAvailableOrderCode = async (attempt: number): Promise<number> => {
      if (attempt >= 5) {
        throw new Error('Failed to generate unique payment order code');
      }

      const orderCode = Date.now() * 1000 + crypto.randomInt(0, 1000);
      const existing = await this.subscriptionRepository.findByOrderId(orderCode.toString());
      if (!existing) return orderCode;

      return findAvailableOrderCode(attempt + 1);
    };

    return findAvailableOrderCode(0);
  }
}
