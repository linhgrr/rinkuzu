import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import {
  adaptiveSessionGetPathParamsSchema,
  adaptiveSessionPostPathParamsSchema,
  adaptiveSubmitAnswerRequestSchema,
} from '@/dtos/adaptive-session';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptiveSessionGetPathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const suffix =
    parsedParams.data.action === 'concept'
      ? `concept/${parsedParams.data.conceptId}`
      : parsedParams.data.action;
  return proxyAdaptiveRequest(req, `/session/${parsedParams.data.sessionId}/${suffix}`, {
    userId,
    userRole: session.user.role,
  });
});

export const POST = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptiveSessionPostPathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  let body: string | undefined;
  if (parsedParams.data.action === 'submit') {
    const parsedBody = await readAndValidateJson(req, adaptiveSubmitAnswerRequestSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, { fields: parsedBody.fields });
    }
    body = JSON.stringify(parsedBody.data);
  }

  const llmAction = ['exercise', 'step'].includes(parsedParams.data.action)
    ? 'adaptive_generation'
    : undefined;

  return proxyAdaptiveRequest(
    req,
    `/session/${parsedParams.data.sessionId}/${parsedParams.data.action}`,
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      ...(llmAction ? { llmAction } : {}),
      ...(body ? { body, contentType: 'application/json' } : {}),
    },
  );
});
