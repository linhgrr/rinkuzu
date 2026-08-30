import { NextRequest } from 'next/server';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { resendVerificationSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { parseJsonBody } from '@/lib/api/validated';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email exists and is unverified, a new verification link has been sent.';

export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, resendVerificationSchema);
  if (!input.ok) return input.response;

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('resend_verification_email', input.data.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.resendVerification(input.data.email, context);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: neutralMessage } })
    : apiServiceErr(result);
}
