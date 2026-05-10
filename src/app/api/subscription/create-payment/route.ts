import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import { apiErr } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const { planId } = await request.json();

    if (!planId) {
      return apiErr('validation_error', 'Plan ID is required', 400);
    }

    // Verify plan exists in database
    await connectDB();
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return apiErr('validation_error', 'Invalid plan ID', 400);
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const paymentData = await subscriptionService.createPaymentRequest(
      (session.user as any).id,
      planId,
    );

    return NextResponse.json({ success: true, data: paymentData });
  } catch (error: any) {
    console.error('Error creating payment request:', error);
    return apiErr('internal_error', error.message || 'Failed to create payment request', 500);
  }
}
