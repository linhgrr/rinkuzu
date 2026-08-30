import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';

import type { ServiceResult } from '@/interfaces/services/types';
import { extractRequestContext, type RequestAuditContext } from '@/lib/audit';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';
import {
  checkAuthRateLimit,
  rateLimitResponse,
  type AuthRateLimitAction,
} from '@/lib/auth-rate-limit';

interface AuthTokenActionRouteOptions<TInput, TData> {
  schema: ZodType<TInput>;
  rateLimitAction: AuthRateLimitAction;
  rateLimitKey: (input: TInput, context: RequestAuditContext) => string;
  execute: (input: TInput, context: RequestAuditContext) => Promise<ServiceResult<TData>>;
  successMessage: string;
}

export function createAuthTokenActionRoute<TInput, TData>(
  options: AuthTokenActionRouteOptions<TInput, TData>,
) {
  return async (request: NextRequest) => {
    const input = await parseJsonBody(request, options.schema);
    if (!input.ok) return input.response;

    const context = extractRequestContext(request);
    const rate = await checkAuthRateLimit(
      options.rateLimitAction,
      options.rateLimitKey(input.data, context),
    );
    if (!rate.allowed) return rateLimitResponse(rate);

    const result = await options.execute(input.data, context);
    return result.success
      ? apiOk(result.data, 200, { meta: { message: options.successMessage } })
      : apiServiceErr(result);
  };
}
