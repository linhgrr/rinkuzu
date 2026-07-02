import { NextRequest } from 'next/server';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { verifyEmailSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';

const authAccountService = getAuthAccountService();

export async function POST(request: NextRequest) {
  const input = await readAndValidateJson(request, verifyEmailSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('verify_email_ip', context.ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.verifyEmail(input.data.token, context);
  return result.success
    ? apiOk(result.data, 200, {
        meta: { message: 'Email verified. You can now sign in.' },
      })
    : apiServiceErr(result);
}
