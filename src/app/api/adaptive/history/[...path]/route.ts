import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import {
  adaptiveHistoryDeletePathParamsSchema,
  adaptiveHistoryDeleteQuerySchema,
  adaptiveHistoryGetPathParamsSchema,
  adaptiveHistoryProgressQuerySchema,
  adaptiveHistorySubjectQuerySchema,
} from '@/dtos/adaptive-history';
import { parseRouteParams, parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = parseRouteParams(params, adaptiveHistoryGetPathParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;

  if (parsedParams.data.kind === 'progress') {
    const query = parseSearchParams(req, adaptiveHistoryProgressQuerySchema);
    if (!query.ok) return query.response;
    return proxyAdaptiveRequest(req, `/history/subjects/progress?limit=${query.data.limit}`, {
      userId,
      userRole: session.user.role,
    });
  }

  const query = parseSearchParams(req, adaptiveHistorySubjectQuerySchema);
  if (!query.ok) return query.response;
  return proxyAdaptiveRequest(req, `/history/subjects/${parsedParams.data.jobId}`, {
    userId,
    userRole: session.user.role,
  });
});

export const DELETE = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = parseRouteParams(params, adaptiveHistoryDeletePathParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;
  const query = parseSearchParams(req, adaptiveHistoryDeleteQuerySchema);
  if (!query.ok) return query.response;

  return proxyAdaptiveRequest(
    req,
    `/history/subjects/${parsedParams.data.jobId}?delete_sessions=${String(
      query.data.delete_sessions,
    )}`,
    { userId, userRole: session.user.role },
    { method: 'DELETE' },
  );
});
