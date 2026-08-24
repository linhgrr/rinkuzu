import type { components } from '@/generated/adaptive-api';
import { withAdmin } from '@/lib/api/auth';
import { fetchApiData } from '@/lib/api/client';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateRouteParams, readAndValidateSearchParams } from '@/lib/api/request';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import {
  premiumReviewCallbackRequestSchema,
  premiumReviewStatusQuerySchema,
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
    await service.attachUpstreamReviewJob(dispatch.localJob.id, upstream.job.jobId);
    return apiOk(
      {
        localJobId: dispatch.localJob.id,
        upstreamJobId: upstream.job.jobId,
        status: upstream.job.status,
        snapshotHash: dispatch.snapshotHash,
      },
      202,
      { headers: PREMIUM_PRIVATE_HEADERS },
    );
  } catch (error) {
    if (dispatch) {
      await service
        .syncReview(dispatch.submissionId, dispatch.localJob.id, {
          jobId: dispatch.localJob.id,
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

export const GET = withAdmin<{ id: string }>(async (request, { params, userId, session }) => {
  try {
    const parsed = readAndValidateRouteParams(params, premiumSubmissionIdParamsSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    const query = readAndValidateSearchParams(request, premiumReviewStatusQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }
    const upstream = await fetchApiData<ReviewResponse>(
      buildAdaptiveUrl(`/premium-quiz/reviews/${query.data.upstreamJobId}`),
      {
        headers: buildAdaptiveServiceHeaders(userId, session.user.role),
        cache: 'no-store',
        signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
      },
    );
    const callback = premiumReviewCallbackRequestSchema.safeParse({
      jobId: query.data.localJobId,
      snapshotHash: upstream.job.snapshotHash,
      status: upstream.job.status,
      ...(upstream.job.result ? { result: upstream.job.result } : {}),
      ...(upstream.job.error ? { error: upstream.job.error } : {}),
    });
    if (!callback.success) {
      return apiErr('upstream_error', 'Invalid Premium review response', 502);
    }
    const submission = await getPremiumQuizService().syncReview(
      parsed.data.id,
      query.data.localJobId,
      callback.data,
    );
    return apiOk(submission, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Poll Premium AI review failed');
    return premiumQuizErrorResponse(error);
  }
});
