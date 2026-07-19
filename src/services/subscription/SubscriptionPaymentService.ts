import crypto from 'crypto';
import type { PaymentRequestDto } from '@/dtos/subscription';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isActiveSubscriptionPremium } from '@/lib/subscription-date';
import type { UserSubscriptionSnapshot } from '@/entities/User';

export class SubscriptionPaymentService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
    private planRepository: ISubscriptionPlanRepository,
  ) {}

  async createPaymentRequest(userId: string, planId: string): Promise<PaymentRequestDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get plan from database
    const plan = await this.planRepository.findActiveById(planId);
    if (!plan) {
      throw new Error('Invalid subscription plan');
    }

    // Check if user already has an active subscription
    const hasActivePremium = this.hasActivePremium(user.subscription);
    if (hasActivePremium) {
      throw new Error('User already has an active subscription');
    }

    // PayOS requires a positive safe integer. Add entropy and verify uniqueness.
    const orderCode = await this.generateUniqueOrderCode();

    // PayOS description phải ≤ 25 ký tự
    const payosDescription = plan.name.length > 25 ? plan.name.substring(0, 25) : plan.name;

    // Create subscription record
    await this.subscriptionRepository.create({
      userId,
      userEmail: user.email,
      type: planId,
      amount: plan.price,
      currency: 'VND',
      status: 'pending',
      payosOrderId: orderCode.toString(),
    });

    // Create payment request with PayOS
    const baseUrl = env.AUTH_URL;
    const returnUrl = `${baseUrl}/payment/success?orderCode=${orderCode}`;
    const cancelUrl = `${baseUrl}/payment/cancel?orderCode=${orderCode}`;

    try {
      const paymentResponse = await this.payosService.createPayment(
        orderCode,
        plan.price,
        payosDescription,
        returnUrl,
        cancelUrl,
        user.email,
        user.name,
      );

      if (paymentResponse.code !== '00') {
        logger.error(
          {
            orderCode,
            code: paymentResponse.code,
            description: paymentResponse.desc,
          },
          'PayOS payment error',
        );
        throw new Error(paymentResponse.desc || 'Failed to create payment request');
      }

      if (!paymentResponse.data?.checkoutUrl) {
        logger.error(
          {
            orderCode,
            code: paymentResponse.code,
          },
          'PayOS response missing payment URL',
        );
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
          id: plan.id,
          name: plan.name,
          price: plan.price,
          duration: plan.duration,
          features: plan.features,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Error in createPaymentRequest');
      // Keep the pending row. A timeout or lost response can happen after PayOS
      // durably created the payment link; deleting here would make a later,
      // correctly signed webhook impossible to reconcile.
      throw error;
    }
  }

  private hasActivePremium(subscription: UserSubscriptionSnapshot | undefined): boolean {
    return isActiveSubscriptionPremium(subscription);
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
