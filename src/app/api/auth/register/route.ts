import { NextRequest } from 'next/server';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/auth';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { parseJsonBody } from '@/lib/api/validated';
import { resolveAccountLocale } from '@/lib/auth/account-locale';
import { FIRST_TOUCH_COOKIE, parseFirstTouch } from '@/lib/attribution/first-touch';
import { ipBucketKey, resolveClientCountry } from '@/lib/client-ip';

const authAccountService = getAuthAccountService();
const neutralMessage =
  'If the email is valid, a verification link has been sent. Check your inbox.';

export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, registerSchema);
  if (!input.ok) return input.response;

  const context = extractRequestContext(request);
  const rate = await checkAuthRateLimit('register_ip', ipBucketKey(context.ip));
  if (!rate.allowed) return rateLimitResponse(rate);

  // The form sends its page locale; older clients fall back to the posting page.
  const locale = resolveAccountLocale({
    explicit: input.data.locale,
    referer: request.headers.get('referer'),
    cookies: request.cookies,
  });
  const signupCountry = resolveClientCountry(request.headers);
  const signupSource = parseFirstTouch(request.cookies.get(FIRST_TOUCH_COOKIE)?.value, new Date());
  const result = await authAccountService.register(
    {
      email: input.data.email,
      password: input.data.password,
      ...(input.data.displayName ? { displayName: input.data.displayName } : {}),
      ...(input.data.callbackUrl ? { callbackUrl: input.data.callbackUrl } : {}),
      ...(input.data.guestClaimTokens?.length
        ? { guestClaimTokens: input.data.guestClaimTokens }
        : {}),
      ...(input.data.guestDraftTokens?.length
        ? { guestDraftTokens: input.data.guestDraftTokens }
        : {}),
      ...(locale ? { locale } : {}),
      ...(signupCountry ? { signupCountry } : {}),
      ...(signupSource ? { signupSource } : {}),
    },
    context,
  );
  return result.success
    ? apiOk(result.data, 201, { meta: { message: neutralMessage } })
    : apiServiceErr(result);
}
