import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSubscriptionService } from '@/lib/subscriptionFactory';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { orderCode } = await request.json();

    if (!orderCode) {
      return NextResponse.json(
        { success: false, message: 'Order code is required' },
        { status: 400 },
      );
    }

    const subscriptionService = createSubscriptionService();
    const numericOrderCode = typeof orderCode === 'string' ? Number(orderCode) : orderCode;
    if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid order code' }, { status: 400 });
    }

    const result = await subscriptionService.verifyAndActivateSubscription(
      numericOrderCode,
      (session.user as any).id,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to verify payment' },
      { status: 500 },
    );
  }
}
