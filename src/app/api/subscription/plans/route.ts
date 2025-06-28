import { NextRequest, NextResponse } from 'next/server';
import SubscriptionService from '@/services/subscription/SubscriptionService';

export async function GET() {
  try {
    const subscriptionService = new SubscriptionService();
    const plans = await subscriptionService.getSubscriptionPlans();
    
    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
} 