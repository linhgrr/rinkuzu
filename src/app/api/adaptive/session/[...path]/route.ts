import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { parseJsonBody, parseRouteParams } from '@/lib/api/validated';
import {
  adaptiveSessionGetPathParamsSchema,
  adaptiveSessionPostPathParamsSchema,
  adaptiveSubmitAnswerRequestSchema,
} from '@/dtos/adaptive-session';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = parseRouteParams(params, adaptiveSessionGetPathParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;

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
  const parsedParams = parseRouteParams(params, adaptiveSessionPostPathParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;

  let body: string | undefined;
  if (parsedParams.data.action === 'submit') {
    const parsedBody = await parseJsonBody(req, adaptiveSubmitAnswerRequestSchema);
    if (!parsedBody.ok) return parsedBody.response;
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
