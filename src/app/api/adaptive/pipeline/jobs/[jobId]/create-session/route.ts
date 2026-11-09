import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import {
  adaptivePipelineJobRouteParamsSchema,
  adaptivePipelineSessionCreateQuerySchema,
} from '@/dtos/adaptive-pipeline';
import { parseRouteParams, parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, { params, userId, session }) => {
  const jobParams = parseRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!jobParams.ok) return jobParams.response;

  const query = parseSearchParams(req, adaptivePipelineSessionCreateQuerySchema);
  if (!query.ok) return query.response;

  const { max_steps, locale } = query.data;
  const upstreamQuery = new URLSearchParams({
    max_steps: String(max_steps),
    ...(locale ? { locale } : {}),
  });
  const response = await proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${jobParams.data.jobId}/create-session?${upstreamQuery}`,
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      llmAction: 'adaptive_generation',
      timeoutMs: 30_000,
    },
  );

  invalidateAdaptiveServiceCache();
  return response;
});
