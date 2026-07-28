import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    window: z.enum(['7d', '30d', '90d', '180d']).default('30d'),
  })
  .strict();

export const GET = withAdmin(async (req, { userId, session }) => {
  const query = readAndValidateSearchParams(req, querySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const upstreamUrl = new URL(req.url);
  upstreamUrl.search = '';
  upstreamUrl.searchParams.set('window', query.data.window);
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
