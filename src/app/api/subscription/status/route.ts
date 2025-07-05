import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const subscription = await subscriptionService.getUserSubscription((session.user as any).id);
    const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

    return NextResponse.json({ 
      success: true, 
      data: { 
        subscription, 
        isPremium 
      } 
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
} 