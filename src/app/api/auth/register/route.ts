import { NextRequest } from 'next/server';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { registerSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email is valid, a verification link has been sent. Check your inbox.';

export async function POST(request: NextRequest) {
  const input = await readAndValidateJson(request, registerSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('register_ip', context.ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.register(input.data, context);
  return result.success
    ? apiOk(result.data, 201, { meta: { message: neutralMessage } })
    : apiServiceErr(result);
}
