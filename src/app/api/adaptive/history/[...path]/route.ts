import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { routePathSchema } from '@/lib/validation/common';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const adaptivePathParamsSchema = z.object({ path: routePathSchema }).strict();

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(req, `/api/history/${parsedParams.data.path}`, {
    userId,
    userRole: session.user.role,
  });
});

export const DELETE = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePathParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(
    req,
    `/api/history/${parsedParams.data.path}`,
    { userId, userRole: session.user.role },
    { method: 'DELETE' },
  );
});
