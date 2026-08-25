import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createPlanCatalogService } from '@/lib/plan-catalog-factory';
import { DurationUtils, SubscriptionDurationType } from '@/types/subscription';

export async function GET() {
  try {
    const plans = await createPlanCatalogService().listActive();

    const transformedPlans = plans.map((plan) => {
      const duration = DurationUtils.getDurationInfo(plan.duration);
      return {
        ...plan,
        durationDisplay: duration.displayName,
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
