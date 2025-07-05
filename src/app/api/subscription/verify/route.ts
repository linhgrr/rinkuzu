import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/serviceFactory';

export async function POST(request: NextRequest) {
  try {
    const { orderCode } = await request.json();
    
    if (!orderCode) {
      return NextResponse.json(
        { success: false, message: 'Order code is required' },
        { status: 400 }
      );
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const numericOrderCode = typeof orderCode === 'string' ? Number(orderCode) : orderCode;
    const result = await subscriptionService.verifyAndActivateSubscription(numericOrderCode);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
} 