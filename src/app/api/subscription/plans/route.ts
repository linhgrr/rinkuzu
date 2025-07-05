import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/serviceFactory';

export async function GET() {
  try {
    const subscriptionService = ServiceFactory.createSubscriptionService();
    const plans = await subscriptionService.getSubscriptionPlans();
    
    // Transform plans to include duration info
    const transformedPlans = plans.map(plan => ({
      ...plan,
      // Include additional duration information for frontend
      durationDisplay: plan.duration === 'PT0S' ? 'Lifetime' : formatDurationDisplay(plan.duration),
      isLifetime: plan.duration === 'PT0S',
      calculatedMonths: parseDurationToMonths(plan.duration)
    }));
    
    return NextResponse.json({ 
      success: true, 
      plans: transformedPlans,
      meta: {
        durationFormat: 'ISO8601',
        supportedDurations: ['P1M', 'P3M', 'P6M', 'P1Y', 'PT0S']
      }
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}

// Helper function to format duration for display
function formatDurationDisplay(iso8601Duration: string): string {
  const durationMap: Record<string, string> = {
    'P1M': '1 Month',
    'P3M': '3 Months',
    'P6M': '6 Months', 
    'P1Y': '1 Year',
    'PT0S': 'Lifetime'
  };
  
  return durationMap[iso8601Duration] || iso8601Duration;
}

// Helper function to parse duration to months
function parseDurationToMonths(iso8601Duration: string): number | undefined {
  if (iso8601Duration === 'PT0S') return undefined; // Lifetime
  
  const monthMatch = iso8601Duration.match(/P(\d+)M/);
  if (monthMatch) {
    return parseInt(monthMatch[1]);
  }
  
  const yearMatch = iso8601Duration.match(/P(\d+)Y/);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 12;
  }
  
  return undefined;
} 