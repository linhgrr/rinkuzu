import { NextRequest } from 'next/server';
import { apiOk, apiErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { resendVerificationSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email exists and is unverified, a new verification link has been sent.';

export async function POST(request: NextRequest) {
  const input = await readAndValidateJson(request, resendVerificationSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('resend_verification_email', input.data.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  await authAccountService.resendVerification(input.data.email, context);
  return apiOk(null, 200, { meta: { message: neutralMessage } });
}
