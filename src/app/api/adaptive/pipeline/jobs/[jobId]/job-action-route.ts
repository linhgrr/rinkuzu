import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { pipelineJobLinkFromEnvelope, reconcilePipelineUsage } from '@/lib/adaptive/pipeline-usage';
import { withAuth } from '@/lib/api/auth';
import {
  adaptivePipelineJobRetryQuerySchema,
  adaptivePipelineJobRouteParamsSchema,
} from '@/dtos/adaptive-pipeline';
import { parseRouteParams, parseSearchParams } from '@/lib/api/validated';

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

    // A retry re-runs the pipeline, so it is metered like a new upload and
    // linked to the job's new attempt. The earlier attempt's unit is refunded
    // as superseded when the job is next read, so a job is charged once.
    // Settle first, so the failed attempt's unit is back before the quota check.
    const auth = { userId, userRole: session.user.role };
    const metered = options.action === 'retry';
    // A retry re-runs the pipeline, so it carries the UI locale like a new upload (RIN-1267).
    let upstreamQuery = '';
    if (metered) {
      const query = parseSearchParams(request, adaptivePipelineJobRetryQuerySchema);
      if (!query.ok) return query.response;
      if (query.data.locale) upstreamQuery = `?locale=${query.data.locale}`;
      await reconcilePipelineUsage(auth);
    }
    const metering = metered
      ? { llmAction: 'adaptive_pipeline' as const, llmJobLink: pipelineJobLinkFromEnvelope }
      : {};
    const response = await proxyAdaptiveRequest(
      request,
      `/pipeline/jobs/${jobParams.data.jobId}/${options.action}${upstreamQuery}`,
      auth,
      { method: 'POST', timeoutMs: options.timeoutMs, ...metering },
    );
    invalidateAdaptiveServiceCache();
    return response;
  });
}
