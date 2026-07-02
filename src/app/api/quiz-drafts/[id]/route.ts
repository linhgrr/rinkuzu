import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { quizDraftIdRouteParamsSchema } from '@/dtos/quiz';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, quizDraftIdRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(req, `/api/quiz/drafts/${parsedParams.data.id}`, {
    userId,
    userRole: session.user.role,
  });
});

export const PATCH = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, quizDraftIdRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(
    req,
    `/api/quiz/drafts/${parsedParams.data.id}`,
    { userId, userRole: session.user.role },
    { method: 'PATCH' },
  );
});

export const DELETE = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, quizDraftIdRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(
    req,
    `/api/quiz/drafts/${parsedParams.data.id}`,
    { userId, userRole: session.user.role },
    { method: 'DELETE' },
  );
});
