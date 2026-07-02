import { NextRequest } from 'next/server';
import { apiOk, apiErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email exists in our system, a reset link has been sent. Check your inbox.';

export async function POST(request: NextRequest) {
  const input = await readAndValidateJson(request, forgotPasswordSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('forgot_password_email', input.data.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  await authAccountService.requestPasswordReset(input.data.email, context);
  return apiOk(null, 200, { meta: { message: neutralMessage } });
}
