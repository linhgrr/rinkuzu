import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';
import { extractUnknownErrorMessage } from '@/lib/api/error';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const { orderCode } = await request.json();

    if (!orderCode) {
      return apiErr('validation_error', 'Order code is required', 400);
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const numericOrderCode = typeof orderCode === 'string' ? Number(orderCode) : orderCode;
    if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
      return apiErr('validation_error', 'Invalid order code', 400);
    }

    const result = await subscriptionService.verifyAndActivateSubscription(
      numericOrderCode,
      session.user.id,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('Error verifying payment:', error);
    return apiErr(
      'internal_error',
      extractUnknownErrorMessage(error, 'Failed to verify payment'),
      500,
    );
  }
}
