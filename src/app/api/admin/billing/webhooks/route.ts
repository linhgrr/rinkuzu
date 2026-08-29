import { NextRequest } from 'next/server';
import { adminBillingWebhookListQuerySchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getAdminBillingOrdersService } from '@/lib/admin-billing-orders-factory';

export const dynamic = 'force-dynamic';

/**
 * What actually arrived at the webhook door.
 *
 * The endpoint itself is unauthenticated by necessity, so every verdict it
 * reaches (accepted, ignored, unreadable, unauthenticated) is written down
 * rather than answered and forgotten. This is where those rows are read. Without
 * it, a one-sided checksum key rotation looks exactly like the provider going
 * quiet, and a retained body that exists to explain a parser failure is never
 * seen by anyone.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  const query = readAndValidateSearchParams(request, adminBillingWebhookListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await getAdminBillingOrdersService().listWebhookDiagnostics(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
