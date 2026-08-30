import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
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

  const upstreamUrl = new URL(req.url);
  upstreamUrl.search = '';
  for (const [key, value] of Object.entries(query.data)) {
    if (value !== undefined && !(key === 'include_non_product' && value === 'false')) {
      upstreamUrl.searchParams.set(key, value);
    }
  }
  const sanitizedRequest = new Request(upstreamUrl, {
    method: 'GET',
    headers: req.headers,
    signal: req.signal,
  });
  const response = await proxyAdaptiveRequest(sanitizedRequest, '/admin/llm-usage/summary', {
    userId,
    userRole: session.user.role,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
});
