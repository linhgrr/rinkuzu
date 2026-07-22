import { z } from 'zod';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { getEntitlementTelemetry } from '@/lib/entitlements/telemetry';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  window: z.enum(['7d', '30d', '90d', '180d']).default('30d'),
});

export const GET = withAdmin(async (request) => {
  const parsed = readAndValidateSearchParams(request, querySchema);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  }
  try {
    const windowDays = Number.parseInt(parsed.data.window, 10);
    return apiOk(await getEntitlementTelemetry(windowDays));
  } catch (error) {
    logger.error({ error }, 'Failed to aggregate entitlement usage telemetry');
    return apiErr('internal_error', 'Failed to fetch entitlement telemetry', 500);
  }
});
