import { NextRequest } from 'next/server';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { parseJsonBody } from '@/lib/api/validated';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email is valid, a verification link has been sent. Check your inbox.';

export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, registerSchema);
  if (!input.ok) return input.response;

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('register_ip', context.ip || 'unknown');
  if (!rate.allowed) return rateLimitResponse(rate);

  const result = await authAccountService.register(
    {
      email: input.data.email,
      password: input.data.password,
      ...(input.data.displayName ? { displayName: input.data.displayName } : {}),
    },
    context,
  );
  return result.success
    ? apiOk(result.data, 201, { meta: { message: neutralMessage } })
    : apiServiceErr(result);
}
