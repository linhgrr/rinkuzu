import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { withAuth } from '@/lib/api/auth';
import { adaptivePipelineJobRouteParamsSchema } from '@/dtos/adaptive-pipeline';
import { parseRouteParams } from '@/lib/api/validated';

interface AdaptiveJobActionRouteOptions {
  action: 'cancel' | 'retry';
  timeoutMs: number;
}

type AdaptiveJobActionRouteHandler = ReturnType<typeof withAuth>;

export function createAdaptiveJobActionRoute(
  options: AdaptiveJobActionRouteOptions,
): AdaptiveJobActionRouteHandler {
  return withAuth(async (request, { params, userId, session }) => {
    const jobParams = parseRouteParams(params, adaptivePipelineJobRouteParamsSchema);
    if (!jobParams.ok) return jobParams.response;

    const response = await proxyAdaptiveRequest(
      request,
      `/pipeline/jobs/${jobParams.data.jobId}/${options.action}`,
      { userId, userRole: session.user.role },
      { method: 'POST', timeoutMs: options.timeoutMs },
    );
    invalidateAdaptiveServiceCache();
    return response;
  });
}
