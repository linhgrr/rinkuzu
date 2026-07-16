import { adaptivePipelineJobRouteParamsSchema } from '@/dtos/adaptive-pipeline';
import { readAndValidateRouteParams, type RouteParams } from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

type AdaptiveJobRouteParamsResult =
  | { success: true; jobId: string }
  | { success: false; response: Response };

export function readAdaptiveJobRouteParams(params: RouteParams): AdaptiveJobRouteParamsResult {
  const parsed = readAndValidateRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!parsed.success) {
    return {
      success: false,
      response: apiErr('validation_error', parsed.error, 400, { fields: parsed.fields }),
    };
  }

  return { success: true, jobId: parsed.data.jobId };
}
