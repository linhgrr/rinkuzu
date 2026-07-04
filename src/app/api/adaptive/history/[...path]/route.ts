import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams, readAndValidateSearchParams } from '@/lib/api/request';
import {
  adaptiveHistoryDeletePathParamsSchema,
  adaptiveHistoryDeleteQuerySchema,
  adaptiveHistoryGetPathParamsSchema,
  adaptiveHistoryProgressQuerySchema,
  adaptiveHistorySubjectQuerySchema,
} from '@/dtos/adaptive-history';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptiveHistoryGetPathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  if (parsedParams.data.kind === 'progress') {
    const query = readAndValidateSearchParams(req, adaptiveHistoryProgressQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }
    return proxyAdaptiveRequest(req, `/api/history/subjects/progress?limit=${query.data.limit}`, {
      userId,
      userRole: session.user.role,
    });
  }

  const query = readAndValidateSearchParams(req, adaptiveHistorySubjectQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }
  return proxyAdaptiveRequest(req, `/api/history/subjects/${parsedParams.data.jobId}`, {
    userId,
    userRole: session.user.role,
  });
});

export const DELETE = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptiveHistoryDeletePathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }
  const query = readAndValidateSearchParams(req, adaptiveHistoryDeleteQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  return proxyAdaptiveRequest(
    req,
    `/api/history/subjects/${parsedParams.data.jobId}?delete_sessions=${String(
      query.data.delete_sessions,
    )}`,
    { userId, userRole: session.user.role },
    { method: 'DELETE' },
  );
});
