import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { BillingDomainError } from './billing-domain';

export function billingHttpError(error: unknown, operation: string): Response {
  if (error instanceof BillingDomainError) {
    return apiErr(error.code, error.message, error.status);
  }
  logger.error({ error, operation }, 'Billing request failed');
  return apiErr('internal_error', 'Billing request failed', 500);
}
