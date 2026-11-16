import { verifyEmailSchema } from '@/lib/validation/auth';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { createAuthTokenActionRoute } from '@/app/api/auth/token-action-route';
import { ipBucketKey } from '@/lib/client-ip';

const authAccountService = getAuthAccountService();

export const POST = createAuthTokenActionRoute({
  schema: verifyEmailSchema,
  rateLimitAction: 'verify_email_ip',
  rateLimitKey: (_input, context) => ipBucketKey(context.ip),
  execute: (input, context) => authAccountService.verifyEmail(input.token, context),
  successMessage: 'Email verified. You can now sign in.',
});
