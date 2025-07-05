import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/serviceFactory';

export async function POST(request: NextRequest) {
  try {
    // Basic authentication check (you may want to implement proper admin auth)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get subscription service
    const subscriptionService = ServiceFactory.createSubscriptionService();
    
    // Check and update expired subscriptions
    await subscriptionService.checkAndUpdateExpiredSubscriptions();
    
    return NextResponse.json({
      success: true,
      message: 'Expired subscriptions checked and updated successfully'
    });
    
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to check expired subscriptions',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 