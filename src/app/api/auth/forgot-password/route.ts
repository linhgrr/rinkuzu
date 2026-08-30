import { NextRequest } from 'next/server';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { parseJsonBody } from '@/lib/api/validated';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email exists in our system, a reset link has been sent. Check your inbox.';

export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, forgotPasswordSchema);
  if (!input.ok) return input.response;

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('forgot_password_email', input.data.email);
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.requestPasswordReset(input.data.email, context);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: neutralMessage } })
    : apiServiceErr(result);
}
