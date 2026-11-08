import { proxyAdminAdaptiveRead } from '@/lib/adaptive/admin-read-proxy';
import { withAdmin } from '@/lib/api/auth';
import { z } from 'zod';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    window: z.enum(['1d', '7d', '30d', '90d', '180d']).default('30d'),
    action: z.string().trim().min(1).max(128).optional(),
    user_id: z.string().trim().min(1).max(128).optional(),
    provider_id: z.string().trim().min(1).max(128).optional(),
    model_config_id: z.string().trim().min(1).max(128).optional(),
    include_non_product: z.enum(['true', 'false']).default('false'),
  })
  .strict();

export const GET = withAdmin(async (req, { userId, session }) => {
  const query = parseSearchParams(req, querySchema);
  if (!query.ok) return query.response;

  const params = {
    ...query.data,
    include_non_product:
      query.data.include_non_product === 'false' ? undefined : query.data.include_non_product,
  };
  return proxyAdminAdaptiveRead(req, params, '/admin/llm-usage/summary', {
    userId,
    userRole: session.user.role,
  });
});
