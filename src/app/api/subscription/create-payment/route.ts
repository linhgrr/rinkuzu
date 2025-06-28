import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SubscriptionService from '@/services/subscription/SubscriptionService';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { planId } = await request.json();
    
    if (!planId) {
      return NextResponse.json(
        { success: false, message: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Verify plan exists in database
    await connectDB();
    const plan = await Plan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, message: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    const subscriptionService = new SubscriptionService();
    const paymentData = await subscriptionService.createPaymentRequest(
      session.user.id,
      planId
    );

    return NextResponse.json({ success: true, data: paymentData });
  } catch (error: any) {
    console.error('Error creating payment request:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create payment request' },
      { status: 500 }
    );
  }
} 