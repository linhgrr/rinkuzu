import type { components } from '@/generated/adaptive-api';
import { withAdmin } from '@/lib/api/auth';
import { fetchApiData } from '@/lib/api/client';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import {
  premiumReviewCallbackRequestSchema,
  premiumSubmissionIdParamsSchema,
} from '@/dtos/premium-quiz';
import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';

type ReviewResponse = components['schemas']['PremiumReviewCreateResponse'];

export const dynamic = 'force-dynamic';

export const POST = withAdmin<{ id: string }>(async (_request, { params, userId, session }) => {
  const parsed = readAndValidateRouteParams(params, premiumSubmissionIdParamsSchema);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  }
  const service = getPremiumQuizService();
  let dispatch: Awaited<ReturnType<typeof service.createReviewDispatch>> | undefined;
  try {
    dispatch = await service.createReviewDispatch(userId, parsed.data.id);
    const upstream = await fetchApiData<ReviewResponse>(buildAdaptiveUrl('/premium-quiz/reviews'), {
      method: 'POST',
      headers: {
        ...buildAdaptiveServiceHeaders(userId, session.user.role),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId: dispatch.submissionId,
        snapshotHash: dispatch.snapshotHash,
        sourceType: dispatch.sourceType,
        snapshot: dispatch.snapshot,
        duplicateReport: dispatch.duplicateReport,
        ...(dispatch.documentFingerprint
          ? { documentFingerprint: dispatch.documentFingerprint }
          : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
    });
    const callback = premiumReviewCallbackRequestSchema.safeParse({
      jobId: dispatch.reviewRequest.id,
      snapshotHash: dispatch.snapshotHash,
      status: 'completed',
      result: upstream.result,
    });
    if (!callback.success) {
      return apiErr('upstream_error', 'Invalid Premium review response', 502);
    }
    const submission = await service.syncReview(
      dispatch.submissionId,
      dispatch.reviewRequest.id,
      callback.data,
    );
    return apiOk(submission, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    if (dispatch) {
      await service
        .syncReview(dispatch.submissionId, dispatch.reviewRequest.id, {
          jobId: dispatch.reviewRequest.id,
          snapshotHash: dispatch.snapshotHash,
          status: 'failed',
          error: 'Unable to dispatch Premium AI review',
        })
        .catch(() => undefined);
    }
    logger.error({ error }, 'Dispatch Premium AI review failed');
    return premiumQuizErrorResponse(error);
  }
});
