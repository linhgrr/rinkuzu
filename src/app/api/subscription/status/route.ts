import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SubscriptionService from '@/services/subscription/SubscriptionService';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getUserSubscription(session.user.id);
    const isPremium = await subscriptionService.isUserPremium(session.user.id);

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