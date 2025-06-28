import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Subscription from '@/models/Subscription';
import Plan from '@/models/Plan';
import PayOSService from '@/services/payment/PayOSService';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

export class SubscriptionService {
  private payosService: PayOSService;

  constructor() {
    this.payosService = new PayOSService();
  }

  async getUserSubscription(userId: string) {
    await connectDB();
    const user = await User.findById(userId).select('subscription');
    return user?.subscription;
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
  ) {
    await connectDB();

    const user = await User.findById(userId);
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
    const subscription = new Subscription({
      user: userId,
      userEmail: user.email,
      type: planId,
      amount: plan.price,
      currency: 'VND',
      status: 'pending',
      payosOrderId: orderCode.toString(),
    });

    await subscription.save();

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
        buyerName: user.name
      });

      const paymentResponse = await this.payosService.createPayment(
        orderCode,
        plan.price,
        payosDescription,
        returnUrl,
        cancelUrl,
        user.email,
        user.name
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
      await Subscription.findOneAndUpdate(
        { payosOrderId: orderCode.toString() },
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
        await Subscription.findOneAndDelete({ payosOrderId: orderCode.toString() });
      } catch (cleanupError) {
        console.error('Failed to cleanup subscription record:', cleanupError);
      }
      
      throw error;
    }
  }

  async verifyAndActivateSubscription(orderCode: number) {
    await connectDB();

    // Get subscription record
    const subscription = await Subscription.findOne({ payosOrderId: orderCode.toString() });
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

    // Calculate subscription dates
    const startDate = new Date();
    let endDate: Date | undefined;

    // Parse duration from plan
    const durationText = plan.duration.toLowerCase();
    if (durationText.includes('tháng') || durationText.includes('month')) {
      const months = parseInt(durationText.match(/\d+/)?.[0] || '0');
      if (months > 0) {
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);
      }
    }
    // For lifetime or other durations, endDate remains undefined

    // Update subscription status
    await Subscription.findOneAndUpdate(
      { payosOrderId: orderCode.toString() },
      {
        status: 'completed',
        payosTransactionId: paymentInfo.data?.reference,
        startDate,
        endDate,
        isActive: true,
      }
    );

    // Update user subscription
    await User.findByIdAndUpdate(subscription.user, {
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
    await connectDB();
    return await Subscription.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async cancelSubscription(userId: string) {
    await connectDB();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has an active subscription with end date (time-limited subscription)
    if (!user.subscription?.endDate) {
      throw new Error('Only time-limited subscriptions can be cancelled');
    }

    // Update user subscription to inactive
    await User.findByIdAndUpdate(userId, {
      'subscription.isActive': false,
    });

    // Update subscription record
    await Subscription.findOneAndUpdate(
      { user: userId, status: 'completed' },
      { isActive: false }
    );

    return { success: true };
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await connectDB();
    
    try {
      // Get plans from database
      const plans = await Plan.find({}).lean();
      
      // Convert to SubscriptionPlan format
      return plans.map(plan => ({
        id: plan._id,
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
}

export default SubscriptionService; 