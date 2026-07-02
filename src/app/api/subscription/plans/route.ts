import { createSubscriptionService } from '@/lib/subscription-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { DurationUtils, SubscriptionDurationType } from '@/types/subscription';

export async function GET() {
  try {
    const subscriptionService = createSubscriptionService();
    const plans = await subscriptionService.getSubscriptionPlans();

    const transformedPlans = plans.map((plan) => {
      const duration = DurationUtils.getDurationInfo(plan.duration);
      return {
        ...plan,
        durationDisplay: duration.displayName,
        isLifetime: plan.duration === SubscriptionDurationType.LIFETIME,
        calculatedMonths: duration.months,
      };
    });

    return apiOk({
      plans: transformedPlans,
      meta: {
        durationFormat: 'ISO8601',
        supportedDurations: Object.values(SubscriptionDurationType),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching subscription plans');
    return apiErr('internal_error', 'Failed to fetch subscription plans', 500);
  }
}
