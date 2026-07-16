import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { withAuth } from '@/lib/api/auth';
import { readAdaptiveJobRouteParams } from './job-route-params';

interface AdaptiveJobActionRouteOptions {
  action: 'cancel' | 'retry';
  timeoutMs: number;
}

type AdaptiveJobActionRouteHandler = ReturnType<typeof withAuth>;

export function createAdaptiveJobActionRoute(
  options: AdaptiveJobActionRouteOptions,
): AdaptiveJobActionRouteHandler {
  return withAuth(async (request, { params, userId, session }) => {
    const jobParams = readAdaptiveJobRouteParams(params);
    if (!jobParams.success) return jobParams.response;

    const response = await proxyAdaptiveRequest(
      request,
      `/pipeline/jobs/${jobParams.jobId}/${options.action}`,
      { userId, userRole: session.user.role },
      { method: 'POST', timeoutMs: options.timeoutMs },
    );
    invalidateAdaptiveServiceCache();
    return response;
  });
}
