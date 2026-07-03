import { NextRequest } from 'next/server';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';

const authAccountService = getAuthAccountService();

export async function POST(request: NextRequest) {
  const input = await readAndValidateJson(request, resetPasswordSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('reset_password_token_ip', context.ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.resetPassword(
    input.data.token,
    input.data.password,
    context,
  );
  return result.success
    ? apiOk(result.data, 200, {
        meta: { message: 'Password updated. Please sign in with your new password.' },
      })
    : apiServiceErr(result);
}
